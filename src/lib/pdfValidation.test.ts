import { describe, expect, it } from "vitest";
import { MAX_PDF_FILE_BYTES } from "./conversionLimits";
import { validatePdfFile } from "./pdfValidation";

if (!Blob.prototype.text) {
  Blob.prototype.text = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("error", () => reject(reader.error));
      reader.addEventListener("load", () => resolve(reader.result as string));
      reader.readAsText(this);
    });
  };
}

const createPdfFile = (contents: string, name = "자료.pdf") =>
  new File([contents], name, { type: "application/pdf" });

describe("validatePdfFile", () => {
  it("accepts a PDF signature anywhere in the first 1024 bytes", async () => {
    await expect(
      validatePdfFile(createPdfFile(`${"x".repeat(1019)}%PDF-1.7`)),
    ).resolves.toBeUndefined();
  });

  it("rejects a renamed non-PDF", async () => {
    await expect(validatePdfFile(createPdfFile("plain text"))).rejects.toThrow(
      "올바른 PDF",
    );
  });

  it("rejects a signature that starts after the first 1024 bytes", async () => {
    await expect(
      validatePdfFile(createPdfFile(`${"x".repeat(1024)}%PDF-1.7`)),
    ).rejects.toThrow("올바른 PDF");
  });

  it("rejects files that are not identified as PDFs by type or extension", async () => {
    await expect(
      validatePdfFile(new File(["%PDF-1.7"], "메모.txt", { type: "text/plain" })),
    ).rejects.toThrow("PDF 파일만");
  });

  it("uses the shared PDF file-size limit before reading the file", async () => {
    const file = createPdfFile("%PDF-1.7");
    Object.defineProperty(file, "size", { value: MAX_PDF_FILE_BYTES + 1 });

    await expect(validatePdfFile(file)).rejects.toThrow("50MB");
  });
});
