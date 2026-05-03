import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildDownloadBlob } from "./downloads";
import type { RenderedPngPage } from "../types/conversion";

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
});
