import { useState } from "react";
import { ConversionPanel } from "./components/ConversionPanel";
import { FileDropzone } from "./components/FileDropzone";
import { ResultList } from "./components/ResultList";
import { renderPdfToPngs } from "./lib/pdfRender";
import { buildDownloadBlob, downloadBlob } from "./lib/downloads";
import type { ConversionProgress, RenderedPngPage } from "./types/conversion";

const TARGET_LONG_EDGE = 1080;

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pages, setPages] = useState<RenderedPngPage[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [statusMessage, setStatusMessage] = useState("PDF 파일을 선택해 주세요.");

  function handleSelectFile(file: File) {
    setSelectedFile(file);
    setPages([]);
    setProgress(null);
    setStatusMessage(`${file.name} 파일이 선택되었습니다.`);
  }

  function handleReset() {
    setSelectedFile(null);
    setPages([]);
    setProgress(null);
    setStatusMessage("PDF 파일을 선택해 주세요.");
  }

  async function handleConvert() {
    if (!selectedFile) {
      setStatusMessage("먼저 PDF 파일을 선택해 주세요.");
      return;
    }

    setIsConverting(true);
    setPages([]);
    setStatusMessage("PDF를 PNG로 변환하고 있습니다.");

    try {
      const renderedPages = await renderPdfToPngs(selectedFile, {
        targetLongEdge: TARGET_LONG_EDGE,
        onProgress: setProgress,
      });
      setPages(renderedPages);
      setStatusMessage(`${renderedPages.length}개의 PNG 파일이 준비되었습니다.`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "변환 중 오류가 발생했습니다.",
      );
    } finally {
      setIsConverting(false);
    }
  }

  async function handleDownload() {
    if (!selectedFile || pages.length === 0) {
      setStatusMessage("다운로드할 PNG가 없습니다.");
      return;
    }

    const output = await buildDownloadBlob(selectedFile.name, pages);
    downloadBlob(output);
    setStatusMessage(`${output.fileName} 다운로드를 시작했습니다.`);
  }

  return (
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="app-title">
        <p className="eyebrow">브라우저 안에서 변환</p>
        <h1 id="app-title">PDF를 1080p PNG로 변환</h1>
        <p className="hero-copy">
          PDF 파일을 선택하면 각 페이지를 PNG로 만들고, 여러 장이면 ZIP으로 묶어
          다운로드합니다.
        </p>
      </section>

      <section className="workspace" aria-label="PDF 변환 작업">
        <FileDropzone
          selectedFile={selectedFile}
          onSelectFile={handleSelectFile}
          onRejectFile={setStatusMessage}
        />
        <ConversionPanel
          selectedFile={selectedFile}
          isConverting={isConverting}
          progress={progress}
          onConvert={handleConvert}
          onReset={handleReset}
        />
        <ResultList pages={pages} onDownload={handleDownload} />
      </section>

      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>
    </main>
  );
}
