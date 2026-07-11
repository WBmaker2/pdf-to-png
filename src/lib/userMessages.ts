import { ConversionLimitError } from "./conversionLimits";
import { PdfValidationError } from "./pdfValidation";

const PASSWORD_ERROR_MESSAGE =
  "암호로 보호된 PDF는 변환할 수 없습니다. 암호를 해제한 뒤 다시 시도해 주세요.";
const INVALID_PDF_ERROR_MESSAGE =
  "PDF 파일을 읽을 수 없습니다. 올바른 PDF 파일인지 확인해 주세요.";
const MISSING_PDF_ERROR_MESSAGE = "PDF 파일을 찾을 수 없습니다. 다시 선택해 주세요.";
const UNEXPECTED_RESPONSE_ERROR_MESSAGE =
  "PDF를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
const ABORT_ERROR_MESSAGE = "작업이 취소되었습니다.";
const CONVERSION_ERROR_MESSAGE = "변환 중 오류가 발생했습니다.";
const DOWNLOAD_ERROR_MESSAGE = "ZIP 파일 생성에 실패했습니다.";

const getErrorName = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "name" in error
    ? String(error.name)
    : undefined;

const getPreservedErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof ConversionLimitError || error instanceof PdfValidationError) {
    return error.message;
  }

  if (getErrorName(error) === "AbortError") {
    return ABORT_ERROR_MESSAGE;
  }

  return undefined;
};

export const getConversionErrorMessage = (error: unknown): string => {
  const preservedMessage = getPreservedErrorMessage(error);
  if (preservedMessage) {
    return preservedMessage;
  }

  switch (getErrorName(error)) {
    case "PasswordException":
      return PASSWORD_ERROR_MESSAGE;
    case "InvalidPDFException":
      return INVALID_PDF_ERROR_MESSAGE;
    case "MissingPDFException":
      return MISSING_PDF_ERROR_MESSAGE;
    case "UnexpectedResponseException":
      return UNEXPECTED_RESPONSE_ERROR_MESSAGE;
    default:
      return CONVERSION_ERROR_MESSAGE;
  }
};

export const getDownloadErrorMessage = (error: unknown): string =>
  getPreservedErrorMessage(error) ?? DOWNLOAD_ERROR_MESSAGE;
