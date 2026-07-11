import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import type { RenderedPngPage } from "../types/conversion";
import { createZipArchive } from "./zipArchive";

const makePages = (): RenderedPngPage[] => [
  {
    pageIndex: 0,
    fileName: "자료-00.png",
    blob: new Blob(["first png"], { type: "image/png" }),
    width: 1920,
    height: 1080,
  },
  {
    pageIndex: 1,
    fileName: "자료-01.png",
    blob: new Blob(["second png"], { type: "image/png" }),
    width: 1920,
    height: 1080,
  },
];

describe("createZipArchive", () => {
  it("stores PNG pages without recompressing them and reports progress", async () => {
    const onProgress = vi.fn();
    const generateAsync = vi.spyOn(JSZip.prototype, "generateAsync");

    const result = await createZipArchive(makePages(), onProgress);

    expect(onProgress).toHaveBeenCalledWith(expect.any(Number));
    expect(result.type).toBe("application/zip");
    expect(generateAsync).toHaveBeenCalledWith(
      {
        type: "blob",
        compression: "STORE",
        mimeType: "application/zip",
      },
      expect.any(Function),
    );
  });
});
