const INVALID_FILENAME_CHAR_PATTERN =
  /[\x00-\x1f\x7f-\x9f<>:"/\\|?*]/g;

export const safeBaseName = (fileName: string): string => {
  const withoutPath = fileName.replace(/\\/g, "/").split("/").pop() ?? "";
  const withoutPdf = withoutPath.trim().replace(/\.pdf$/i, "");
  const sanitized = withoutPdf
    .replace(INVALID_FILENAME_CHAR_PATTERN, "-")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized || "document";
};

export const pageIndexWidth = (totalPages: number): number =>
  Math.max(2, String(Math.max(0, totalPages - 1)).length);

export const buildPngFileName = (
  originalFileName: string,
  pageIndex: number,
  totalPages: number,
): string => {
  const baseName = safeBaseName(originalFileName);
  const width = pageIndexWidth(totalPages);
  const paddedIndex = String(pageIndex).padStart(width, "0");
  return `${baseName}-${paddedIndex}.png`;
};

export const buildZipFileName = (originalFileName: string): string => {
  const baseName = safeBaseName(originalFileName);
  return `${baseName}-png-1080px.zip`;
};
