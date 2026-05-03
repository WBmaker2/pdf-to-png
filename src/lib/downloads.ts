import JSZip from "jszip";
import type { RenderedPngPage } from "../types/conversion";
import { buildZipFileName } from "./fileNames";

export type DownloadBlob = {
  fileName: string;
  blob: Blob;
};

export const buildDownloadBlob = async (
  originalFileName: string,
  pages: RenderedPngPage[],
): Promise<DownloadBlob> => {
  if (pages.length === 0) {
    throw new Error("다운로드할 PNG가 없습니다.");
  }

  if (pages.length === 1) {
    const page = pages[0];
    return { fileName: page.fileName, blob: page.blob };
  }

  const zip = new JSZip();
  for (const page of pages) {
    zip.file(page.fileName, page.blob);
  }

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
  });

  return {
    fileName: buildZipFileName(originalFileName),
    blob: zipBlob,
  };
};

export const downloadBlob = (download: DownloadBlob): void => {
  const objectUrl = URL.createObjectURL(download.blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = download.fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
};
