import { describe, expect, it } from "vitest";
import {
  MAX_PDF_FILE_BYTES,
  MAX_PDF_PAGE_COUNT,
  MAX_RENDERED_PNG_BYTES,
  assertPdfFileSize,
  assertPdfPageCount,
  assertRenderedPngBytes,
} from "./conversionLimits";

describe("conversion limits", () => {
  it("accepts exact limits", () => {
    expect(() => assertPdfFileSize({ size: MAX_PDF_FILE_BYTES })).not.toThrow();
    expect(() => assertPdfPageCount(MAX_PDF_PAGE_COUNT)).not.toThrow();
    expect(() => assertRenderedPngBytes(MAX_RENDERED_PNG_BYTES)).not.toThrow();
  });

  it("rejects values over each limit with Korean guidance", () => {
    expect(() => assertPdfFileSize({ size: MAX_PDF_FILE_BYTES + 1 })).toThrow("50MB");
    expect(() => assertPdfPageCount(MAX_PDF_PAGE_COUNT + 1)).toThrow("50페이지");
    expect(() => assertRenderedPngBytes(MAX_RENDERED_PNG_BYTES + 1)).toThrow("200MB");
  });
});
