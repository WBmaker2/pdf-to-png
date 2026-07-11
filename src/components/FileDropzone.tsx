import { useLayoutEffect, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { validatePdfFile } from "../lib/pdfValidation";
import { getConversionErrorMessage } from "../lib/userMessages";

type FileDropzoneProps = {
  selectedFile: File | null;
  isDisabled?: boolean;
  validationResetId: number;
  onSelectFile: (file: File) => void;
  onRejectFile: (message: string) => void;
  onValidationChange?: (isValidating: boolean) => void;
};

const formatFileSize = (size: number): string => {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export function FileDropzone({
  selectedFile,
  isDisabled = false,
  validationResetId,
  onSelectFile,
  onRejectFile,
  onValidationChange,
}: FileDropzoneProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const validationIdRef = useRef(0);
  const onValidationChangeRef = useRef(onValidationChange);
  const isSelectionDisabled = isDisabled || isValidating;

  useLayoutEffect(() => {
    onValidationChangeRef.current = onValidationChange;
  }, [onValidationChange]);

  useLayoutEffect(() => {
    validationIdRef.current += 1;
    setIsValidating(false);
    setIsDragging(false);
    onValidationChangeRef.current?.(false);

    return () => {
      validationIdRef.current += 1;
    };
  }, [validationResetId]);

  const setValidationState = (nextIsValidating: boolean) => {
    setIsValidating(nextIsValidating);
    onValidationChangeRef.current?.(nextIsValidating);
  };

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const validationId = validationIdRef.current + 1;
    validationIdRef.current = validationId;
    setValidationState(true);

    try {
      await validatePdfFile(file);
      if (validationIdRef.current !== validationId) {
        return;
      }

      onSelectFile(file);
    } catch (error) {
      if (validationIdRef.current !== validationId) {
        return;
      }

      onRejectFile(getConversionErrorMessage(error));
    } finally {
      if (validationIdRef.current === validationId) {
        setValidationState(false);
      }
    }
  }

  return (
    <section
      className={`workflow-band dropzone${isDragging ? " is-dragging" : ""}`}
      aria-label="PDF 업로드"
      aria-busy={isValidating}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!isSelectionDisabled && event.dataTransfer.types.includes("Files")) {
          setIsDragging(true);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!isSelectionDisabled && event.dataTransfer.types.includes("Files")) {
          event.dataTransfer.dropEffect = "copy";
          setIsDragging(true);
        }
      }}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget;
        if (!nextTarget || !event.currentTarget.contains(nextTarget as Node)) {
          setIsDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        if (!isSelectionDisabled) {
          void handleFile(event.dataTransfer.files?.[0]);
        }
      }}
    >
      <div className="band-heading">
        <FileUp aria-hidden="true" className="dropzone-icon" />
        <div>
          <span className="band-step">1. 파일</span>
          <h2>PDF 파일 선택</h2>
          <p>파일은 브라우저 안에서만 처리됩니다.</p>
        </div>
      </div>
      <div className="upload-actions">
        <label
          className={`file-button${isSelectionDisabled ? " is-disabled" : ""}`}
          aria-disabled={isSelectionDisabled}
        >
          <FileUp aria-hidden="true" />
          PDF 파일 선택
          <input
            className="file-input"
            aria-label="PDF 파일 선택"
            accept="application/pdf,.pdf"
            disabled={isSelectionDisabled}
            type="file"
            onChange={(event) => {
              handleFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <p className="dropzone-hint">PDF를 이곳에 끌어다 놓을 수 있습니다.</p>
      </div>
      <p className="limit-line">50MB 이하 · 최대 50페이지</p>
      {selectedFile ? (
        <dl className="selected-file">
          <div>
            <dt>선택한 파일</dt>
            <dd>{selectedFile.name}</dd>
          </div>
          <div>
            <dt>크기</dt>
            <dd>{formatFileSize(selectedFile.size)}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}

export default FileDropzone;
