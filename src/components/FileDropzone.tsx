import { FileUp } from "lucide-react";

type FileDropzoneProps = {
  selectedFile: File | null;
  onSelectFile: (file: File) => void;
  onRejectFile: (message: string) => void;
};

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function FileDropzone({
  selectedFile,
  onSelectFile,
  onRejectFile,
}: FileDropzoneProps) {
  function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!isPdf(file)) {
      onRejectFile("PDF 파일만 선택할 수 있습니다.");
      return;
    }

    onSelectFile(file);
  }

  return (
    <section className="dropzone" aria-label="PDF 업로드">
      <FileUp aria-hidden="true" className="dropzone-icon" />
      <div>
        <h2>PDF 파일 선택</h2>
        <p>파일은 브라우저 안에서만 처리됩니다.</p>
      </div>
      <label className="file-button">
        PDF 파일 선택
        <input
          aria-label="PDF 파일 선택"
          accept="application/pdf,.pdf"
          type="file"
          onChange={(event) => handleFile(event.currentTarget.files?.[0])}
        />
      </label>
      {selectedFile ? <p className="selected-file">{selectedFile.name}</p> : null}
    </section>
  );
}

export default FileDropzone;
