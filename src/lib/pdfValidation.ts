import { assertPdfFileSize } from "./conversionLimits";

const PDF_HEADER_BYTES = 1024;

export class PdfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfValidationError";
  }
}

const isPdf = (file: File): boolean =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

export const validatePdfFile = async (file: File): Promise<void> => {
  if (!isPdf(file)) {
    throw new PdfValidationError("PDF 파일만 선택할 수 있습니다.");
  }

  assertPdfFileSize(file);

  const header = await file.slice(0, PDF_HEADER_BYTES).text();
  if (!header.includes("%PDF-")) {
    throw new PdfValidationError(
      "올바른 PDF 파일인지 확인한 뒤 다시 선택해 주세요.",
    );
  }
};
