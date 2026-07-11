import { useRef, useState } from "react";
import { ConversionPanel } from "./components/ConversionPanel";
import { FileDropzone } from "./components/FileDropzone";
import { ResultList } from "./components/ResultList";
import { renderPdfToPngs } from "./lib/pdfRender";
import { buildDownloadBlob, downloadBlob } from "./lib/downloads";
import {
  getConversionErrorMessage,
  getDownloadErrorMessage,
} from "./lib/userMessages";
import type { ConversionProgress, RenderedPngPage } from "./types/conversion";

const TARGET_LONG_EDGE = 1080;

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pages, setPages] = useState<RenderedPngPage[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [statusMessage, setStatusMessage] = useState("PDF 파일을 선택해 주세요.");
  const [validationResetId, setValidationResetId] = useState(0);
  const conversionIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const downloadIdRef = useRef(0);
  const downloadAbortControllerRef = useRef<AbortController | null>(null);

  function cancelActiveConversion() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }

  function cancelActiveDownload() {
    downloadAbortControllerRef.current?.abort();
    downloadAbortControllerRef.current = null;
    downloadIdRef.current += 1;
    setIsDownloading(false);
    setDownloadProgress(0);
  }

  function handleSelectFile(file: File) {
    cancelActiveConversion();
    cancelActiveDownload();
    conversionIdRef.current += 1;
    setSelectedFile(file);
    setPages([]);
    setIsConverting(false);
    setProgress(null);
    setStatusMessage(`${file.name} 파일이 선택되었습니다.`);
  }

  function handleReset() {
    cancelActiveConversion();
    cancelActiveDownload();
    conversionIdRef.current += 1;
    setValidationResetId((currentId) => currentId + 1);
    setSelectedFile(null);
    setPages([]);
    setIsConverting(false);
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
    const conversionId = conversionIdRef.current + 1;
    conversionIdRef.current = conversionId;
    const abortController = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = abortController;
    setStatusMessage("PDF를 PNG로 변환하고 있습니다.");

    try {
      const renderedPages = await renderPdfToPngs(selectedFile, {
        targetLongEdge: TARGET_LONG_EDGE,
        signal: abortController.signal,
        onProgress: (nextProgress) => {
          if (conversionIdRef.current !== conversionId) {
            return;
          }

          setProgress(nextProgress);
          setStatusMessage(
            `${nextProgress.currentPage} / ${nextProgress.totalPages} 페이지 변환 중`,
          );
        },
      });

      if (conversionIdRef.current !== conversionId) {
        return;
      }

      setPages(renderedPages);
      setProgress(null);
      setStatusMessage(`${renderedPages.length}개의 PNG 파일이 준비되었습니다.`);
    } catch (error) {
      if (conversionIdRef.current !== conversionId) {
        return;
      }

      setProgress(null);
      setStatusMessage(getConversionErrorMessage(error));
    } finally {
      if (conversionIdRef.current === conversionId) {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
        setIsConverting(false);
      }
    }
  }

  async function handleDownload() {
    if (!selectedFile || pages.length === 0) {
      setStatusMessage("다운로드할 PNG가 없습니다.");
      return;
    }

    if (isDownloading || downloadAbortControllerRef.current) {
      return;
    }

    const downloadId = downloadIdRef.current + 1;
    downloadIdRef.current = downloadId;
    const abortController = new AbortController();
    downloadAbortControllerRef.current = abortController;
    setIsDownloading(true);
    setDownloadProgress(0);
    setStatusMessage("ZIP 파일을 생성하고 있습니다.");

    try {
      const output = await buildDownloadBlob(selectedFile.name, pages, {
        signal: abortController.signal,
        onProgress: (percent) => {
          if (downloadIdRef.current === downloadId) {
            setDownloadProgress(Math.round(percent));
          }
        },
      });

      if (downloadIdRef.current !== downloadId) {
        return;
      }

      downloadBlob(output);
      setStatusMessage(`${output.fileName} 다운로드를 시작했습니다.`);
    } catch (error) {
      if (downloadIdRef.current !== downloadId) {
        return;
      }

      setStatusMessage(getDownloadErrorMessage(error));
    } finally {
      if (downloadIdRef.current === downloadId) {
        if (downloadAbortControllerRef.current === abortController) {
          downloadAbortControllerRef.current = null;
        }
        setIsDownloading(false);
        setDownloadProgress(0);
      }
    }
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
          isDisabled={isConverting}
          validationResetId={validationResetId}
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
        <ResultList
          pages={pages}
          isDownloading={isDownloading}
          downloadProgress={downloadProgress}
          onDownload={handleDownload}
        />
      </section>

      <p className="status-message" role="status" aria-live="polite">
        {statusMessage}
      </p>
    </main>
  );
}
