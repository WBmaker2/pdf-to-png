import { useRef, useState } from "react";
import { ConversionPanel } from "./components/ConversionPanel";
import { FileDropzone } from "./components/FileDropzone";
import { ResultList } from "./components/ResultList";
import { StatusNotice, type StatusTone } from "./components/StatusNotice";
import {
  getConversionErrorMessage,
  getDownloadErrorMessage,
} from "./lib/userMessages";
import type { ConversionProgress, RenderedPngPage } from "./types/conversion";

const TARGET_LONG_EDGE = 1080;

type StatusState = {
  tone: StatusTone;
  message: string;
};

const isAbortError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pages, setPages] = useState<RenderedPngPage[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [status, setStatus] = useState<StatusState | null>({
    tone: "info",
    message: "PDF 파일을 선택해 주세요.",
  });
  const [validationResetId, setValidationResetId] = useState(0);
  const conversionIdRef = useRef(0);
  const conversionInFlightRef = useRef(false);
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
    conversionInFlightRef.current = false;
    setSelectedFile(file);
    setPages([]);
    setIsConverting(false);
    setProgress(null);
    setStatus(null);
  }

  function handleReset() {
    cancelActiveConversion();
    cancelActiveDownload();
    conversionIdRef.current += 1;
    conversionInFlightRef.current = false;
    setValidationResetId((currentId) => currentId + 1);
    setSelectedFile(null);
    setPages([]);
    setIsConverting(false);
    setIsValidating(false);
    setProgress(null);
    setStatus({ tone: "info", message: "PDF 파일을 선택해 주세요." });
  }

  async function handleConvert() {
    if (isValidating || conversionInFlightRef.current) {
      return;
    }

    if (!selectedFile) {
      setStatus({ tone: "error", message: "먼저 PDF 파일을 선택해 주세요." });
      return;
    }

    conversionInFlightRef.current = true;
    setIsConverting(true);
    setPages([]);
    setProgress(null);
    const conversionId = conversionIdRef.current + 1;
    conversionIdRef.current = conversionId;
    const abortController = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = abortController;
    setStatus(null);

    try {
      const { renderPdfToPngs } = await import("./lib/pdfRender");
      if (conversionIdRef.current !== conversionId || abortController.signal.aborted) {
        return;
      }

      const renderedPages = await renderPdfToPngs(selectedFile, {
        targetLongEdge: TARGET_LONG_EDGE,
        signal: abortController.signal,
        onProgress: (nextProgress) => {
          if (conversionIdRef.current !== conversionId) {
            return;
          }

          setProgress(nextProgress);
        },
      });

      if (conversionIdRef.current !== conversionId) {
        return;
      }

      setPages(renderedPages);
      setProgress(null);
      setStatus(null);
    } catch (error) {
      if (conversionIdRef.current !== conversionId) {
        return;
      }

      setProgress(null);
      setStatus({
        tone: isAbortError(error) ? "info" : "error",
        message: getConversionErrorMessage(error),
      });
    } finally {
      if (conversionIdRef.current === conversionId) {
        conversionInFlightRef.current = false;
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
        setIsConverting(false);
      }
    }
  }

  async function handleDownload() {
    if (isValidating) {
      return;
    }

    if (!selectedFile || pages.length === 0) {
      setStatus({ tone: "error", message: "다운로드할 PNG가 없습니다." });
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
    setStatus(null);

    try {
      const { buildDownloadBlob, downloadBlob } = await import("./lib/downloads");
      if (downloadIdRef.current !== downloadId || abortController.signal.aborted) {
        return;
      }

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
      setStatus({ tone: "info", message: `${output.fileName} 다운로드를 시작했습니다.` });
    } catch (error) {
      if (downloadIdRef.current !== downloadId) {
        return;
      }

      setStatus({
        tone: isAbortError(error) ? "info" : "error",
        message: getDownloadErrorMessage(error),
      });
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

  const canReset = Boolean(
    selectedFile || pages.length > 0 || isConverting || isDownloading || isValidating,
  );

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1 id="app-title">PDF PNG 변환기</h1>
        <p>긴 변 1080px · 브라우저 내 처리</p>
      </header>

      <section className="converter-tool" aria-labelledby="app-title" aria-label="PDF 변환 작업">
        <FileDropzone
          selectedFile={selectedFile}
          isDisabled={isConverting || isDownloading}
          validationResetId={validationResetId}
          onSelectFile={handleSelectFile}
          onRejectFile={(message) => setStatus({ tone: "error", message })}
          onValidationChange={setIsValidating}
        />
        <ConversionPanel
          selectedFile={selectedFile}
          isConverting={isConverting}
          isDownloading={isDownloading}
          isValidating={isValidating}
          progress={progress}
          canReset={canReset}
          onConvert={handleConvert}
          onReset={handleReset}
        />
        <ResultList
          pages={pages}
          isDownloading={isDownloading}
          isValidating={isValidating}
          downloadProgress={downloadProgress}
          announceCompletion={pages.length > 0 && !isDownloading && !status}
          onDownload={handleDownload}
        />
        {status ? <StatusNotice tone={status.tone} message={status.message} /> : null}
      </section>
    </main>
  );
}
