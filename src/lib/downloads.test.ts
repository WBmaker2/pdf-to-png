import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDownloadBlob, downloadBlob } from "./downloads";
import type { RenderedPngPage } from "../types/conversion";

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

const stubObjectUrlApis = () => {
  const objectUrl = "blob:download-url";
  const createObjectURL = vi.fn(() => objectUrl);
  const revokeObjectURL = vi.fn();

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  });

  return { createObjectURL, objectUrl, revokeObjectURL };
};

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: originalCreateObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: originalRevokeObjectURL,
  });
  document.body.innerHTML = "";
});

describe("download packager", () => {
  it("returns the single png as-is", async () => {
    const blob = new Blob(["single-image"], { type: "image/png" });
    const pages: RenderedPngPage[] = [
      {
        pageIndex: 0,
        fileName: "자료-00.png",
        blob,
        width: 1920,
        height: 1080,
      },
    ];

    const result = await buildDownloadBlob("자료.pdf", pages);

    expect(result.fileName).toBe("자료-00.png");
    expect(result.blob).toBe(blob);
    expect(result.blob.type).toBe("image/png");
  });

  it("returns a zip download for multiple pages", async () => {
    const pages: RenderedPngPage[] = [
      {
        pageIndex: 0,
        fileName: "자료-00.png",
        blob: new Blob(["page-0"], { type: "image/png" }),
        width: 1920,
        height: 1080,
      },
      {
        pageIndex: 1,
        fileName: "자료-01.png",
        blob: new Blob(["page-1"], { type: "image/png" }),
        width: 1920,
        height: 1080,
      },
    ];

    const result = await buildDownloadBlob("자료.pdf", pages);

    expect(result.fileName).toBe("자료-png-1080p.zip");
    expect(result.blob.type).toBe("application/zip");

    const zip = await JSZip.loadAsync(result.blob);
    const entries = Object.keys(zip.files).filter((entry) => !zip.files[entry].dir);
    expect(entries.sort()).toEqual(["자료-00.png", "자료-01.png"]);
  });

  it("clicks and cleans up the anchor for direct downloads", () => {
    const blob = new Blob(["image"], { type: "image/png" });
    const { createObjectURL, objectUrl, revokeObjectURL } = stubObjectUrlApis();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    downloadBlob({ fileName: "자료-00.png", blob });

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
    expect(document.body.querySelectorAll("a")).toHaveLength(0);
  });

  it("still cleans up the anchor and object URL when click throws", () => {
    const blob = new Blob(["image"], { type: "image/png" });
    const { objectUrl, revokeObjectURL } = stubObjectUrlApis();
    const clickError = new Error("click failed");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw clickError;
    });

    let thrownError: unknown;
    try {
      downloadBlob({ fileName: "자료-00.png", blob });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBe(clickError);
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
    expect(document.body.querySelectorAll("a")).toHaveLength(0);
  });
});
