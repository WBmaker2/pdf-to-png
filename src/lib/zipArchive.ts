import JSZip from "jszip";
import type { RenderedPngPage } from "../types/conversion";

export const createZipArchive = async (
  pages: RenderedPngPage[],
  onProgress?: (percent: number) => void,
): Promise<Blob> => {
  const zip = new JSZip();

  for (const page of pages) {
    zip.file(page.fileName, page.blob, { compression: "STORE" });
  }

  return zip.generateAsync(
    { type: "blob", compression: "STORE", mimeType: "application/zip" },
    ({ percent }) => onProgress?.(Math.round(percent)),
  );
};
