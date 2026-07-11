export const MAX_PDF_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_PDF_PAGE_COUNT = 50;
export const MAX_RENDERED_PNG_BYTES = 200 * 1024 * 1024;

export class ConversionLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversionLimitError";
  }
}

export function assertPdfFileSize(file: Pick<File, "size">): void {
  if (file.size > MAX_PDF_FILE_BYTES) {
    throw new ConversionLimitError("PDF 파일은 50MB 이하만 변환할 수 있습니다.");
  }
}

export function assertPdfPageCount(pageCount: number): void {
  if (pageCount > MAX_PDF_PAGE_COUNT) {
    throw new ConversionLimitError("PDF는 최대 50페이지까지 변환할 수 있습니다.");
  }
}

export function assertRenderedPngBytes(totalBytes: number): void {
  if (totalBytes > MAX_RENDERED_PNG_BYTES) {
    throw new ConversionLimitError("변환 결과가 200MB를 넘어 작업을 중단했습니다.");
  }
}
