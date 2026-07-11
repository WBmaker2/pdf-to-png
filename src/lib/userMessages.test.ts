import { describe, expect, it } from "vitest";
import { ConversionLimitError } from "./conversionLimits";
import {
  getConversionErrorMessage,
  getDownloadErrorMessage,
} from "./userMessages";

describe("getConversionErrorMessage", () => {
  it("maps PDF.js failures to fixed Korean guidance", () => {
    expect(
      getConversionErrorMessage({ name: "PasswordException", message: "raw" }),
    ).toBe("암호로 보호된 PDF는 변환할 수 없습니다. 암호를 해제한 뒤 다시 시도해 주세요.");
    expect(
      getConversionErrorMessage({ name: "InvalidPDFException", message: "raw" }),
    ).toBe("PDF 파일을 읽을 수 없습니다. 올바른 PDF 파일인지 확인해 주세요.");
    expect(
      getConversionErrorMessage({ name: "MissingPDFException", message: "raw" }),
    ).toBe("PDF 파일을 찾을 수 없습니다. 다시 선택해 주세요.");
    expect(
      getConversionErrorMessage({ name: "UnexpectedResponseException", message: "raw" }),
    ).toBe("PDF를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
  });

  it("preserves explicit limits and distinguishes cancellation", () => {
    expect(
      getConversionErrorMessage(
        new ConversionLimitError("PDF 파일은 50MB 이하만 변환할 수 있습니다."),
      ),
    ).toBe("PDF 파일은 50MB 이하만 변환할 수 있습니다.");
    expect(getConversionErrorMessage(new DOMException("raw", "AbortError"))).toBe(
      "작업이 취소되었습니다.",
    );
  });

  it("does not expose unknown conversion errors", () => {
    expect(getConversionErrorMessage(new Error("internal stack detail"))).toBe(
      "변환 중 오류가 발생했습니다.",
    );
  });
});

describe("getDownloadErrorMessage", () => {
  it("preserves explicit limits and distinguishes cancellation", () => {
    expect(
      getDownloadErrorMessage(
        new ConversionLimitError("변환 결과가 200MB를 넘어 작업을 중단했습니다."),
      ),
    ).toBe("변환 결과가 200MB를 넘어 작업을 중단했습니다.");
    expect(getDownloadErrorMessage(new DOMException("raw", "AbortError"))).toBe(
      "작업이 취소되었습니다.",
    );
  });

  it("does not expose unknown download errors", () => {
    expect(getDownloadErrorMessage(new Error("internal worker failure"))).toBe(
      "ZIP 파일 생성에 실패했습니다.",
    );
  });
});
