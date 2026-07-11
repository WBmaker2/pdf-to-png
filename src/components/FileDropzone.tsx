import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { validatePdfFile } from "../lib/pdfValidation";
import { getConversionErrorMessage } from "../lib/userMessages";

type FileDropzoneProps = {
  selectedFile: File | null;
  isDisabled?: boolean;
  onSelectFile: (file: File) => void;
  onRejectFile: (message: string) => void;
};

export function FileDropzone({
  selectedFile,
  isDisabled = false,
  onSelectFile,
  onRejectFile,
}: FileDropzoneProps) {
  const [isValidating, setIsValidating] = useState(false);
  const validationIdRef = useRef(0);
  const isSelectionDisabled = isDisabled || isValidating;

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const validationId = validationIdRef.current + 1;
    validationIdRef.current = validationId;
    setIsValidating(true);

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
        setIsValidating(false);
      }
    }
  }

  return (
    <section className="dropzone" aria-label="PDF 업로드">
      <FileUp aria-hidden="true" className="dropzone-icon" />
      <div>
        <h2>PDF 파일 선택</h2>
        <p>파일은 브라우저 안에서만 처리됩니다.</p>
      </div>
      <label className={`file-button${isSelectionDisabled ? " is-disabled" : ""}`}>
        PDF 파일 선택
        <input
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
      {selectedFile ? <p className="selected-file">{selectedFile.name}</p> : null}
    </section>
  );
}

export default FileDropzone;
