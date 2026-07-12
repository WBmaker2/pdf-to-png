import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  assertPdfFileSize,
  assertPdfPageCount,
  assertRenderedPngBytes,
} from "./conversionLimits";
import { buildPngFileName } from "./fileNames";
import { getScaleForLongEdge } from "./pageScale";
import type {
  ConversionProgress,
  RenderedPngPage,
} from "../types/conversion";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export type RenderPdfOptions = {
  targetLongEdge: number;
  onProgress?: (progress: ConversionProgress) => void;
  signal?: AbortSignal;
};

const createAbortError = () =>
  new DOMException("변환이 취소되었습니다.", "AbortError");

const isAbortError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  error.name === "AbortError";

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw createAbortError();
  }
};

const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("PNG 생성에 실패했습니다."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });

export const renderPdfToPngs = async (
  file: File,
  { targetLongEdge, onProgress, signal }: RenderPdfOptions,
): Promise<RenderedPngPage[]> => {
  throwIfAborted(signal);
  assertPdfFileSize(file);
  const data = await file.arrayBuffer();
  throwIfAborted(signal);
  const loadingTask = pdfjsLib.getDocument({ data });

  let loadingTaskDestroyPromise: Promise<void> | null = null;
  const destroyLoadingTask = (): Promise<void> => {
    if (!loadingTaskDestroyPromise) {
      try {
        loadingTaskDestroyPromise = typeof loadingTask.destroy === "function"
          ? Promise.resolve(loadingTask.destroy())
          : Promise.resolve();
      } catch (error) {
        loadingTaskDestroyPromise = Promise.reject(error);
      }
    }

    return loadingTaskDestroyPromise;
  };
  const handleLoadingAbort = () => {
    void destroyLoadingTask().catch(() => undefined);
  };
  signal?.addEventListener("abort", handleLoadingAbort, { once: true });

  let doc: pdfjsLib.PDFDocumentProxy | null = null;
  try {
    doc = await loadingTask.promise;
  } catch (error) {
    signal?.removeEventListener("abort", handleLoadingAbort);
    const primaryError = signal?.aborted || isAbortError(error)
      ? createAbortError()
      : error;
    try {
      await destroyLoadingTask();
    } catch {
      // Preserve the loading failure or the requested cancellation.
    }
    throw primaryError;
  }
  signal?.removeEventListener("abort", handleLoadingAbort);

  if (!doc) {
    const documentError = new Error("pdf 문서 로드에 실패했습니다.");
    try {
      await destroyLoadingTask();
    } catch {
      // Preserve the missing-document error.
    }
    throw documentError;
  }

  const pdf = doc;
  const pages: RenderedPngPage[] = [];
  let renderedBytes = 0;
  let primaryError: unknown;
  try {
    // Keep the post-load abort check inside the document cleanup boundary.
    throwIfAborted(signal);
    assertPdfPageCount(pdf.numPages);

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      throwIfAborted(signal);
      let page: pdfjsLib.PDFPageProxy | null = null;
      let canvas: HTMLCanvasElement | null = null;
      let pagePrimaryError: unknown;

      try {
        page = await pdf.getPage(pageNumber);
        throwIfAborted(signal);
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = getScaleForLongEdge(
          {
            width: unscaledViewport.width,
            height: unscaledViewport.height,
          },
          targetLongEdge,
        );
        const viewport = page.getViewport({ scale });
        canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { alpha: false });

        if (!context) {
          throw new Error("캔버스 렌더링 컨텍스트를 만들 수 없습니다.");
        }

        const width = Math.round(viewport.width);
        const height = Math.round(viewport.height);
        canvas.width = width;
        canvas.height = height;

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        const renderTask = page.render({ canvas, viewport });
        const handleRenderAbort = () => {
          renderTask.cancel();
        };
        signal?.addEventListener("abort", handleRenderAbort, { once: true });

        try {
          await renderTask.promise;
        } catch (error) {
          if (signal?.aborted) {
            throw createAbortError();
          }
          throw error;
        } finally {
          signal?.removeEventListener("abort", handleRenderAbort);
        }

        const blob = await canvasToPngBlob(canvas);
        throwIfAborted(signal);
        assertRenderedPngBytes(renderedBytes + blob.size);
        renderedBytes += blob.size;
        pages.push({
          pageIndex: pageNumber - 1,
          fileName: buildPngFileName(file.name, pageNumber - 1, pdf.numPages),
          blob,
          width,
          height,
        });
        onProgress?.({
          currentPage: pageNumber,
          totalPages: pdf.numPages,
        });
      } catch (error) {
        pagePrimaryError = signal?.aborted ? createAbortError() : error;
        throw pagePrimaryError;
      } finally {
        let pageCleanupFailed = false;
        let pageCleanupError: unknown;
        try {
          if (typeof page?.cleanup === "function") {
            await page.cleanup();
          }
        } catch (error) {
          pageCleanupFailed = true;
          pageCleanupError = error;
        }
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
        if (pagePrimaryError === undefined && pageCleanupFailed) {
          throw pageCleanupError;
        }
      }
    }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    let cleanupFailed = false;
    let cleanupError: unknown;
    try {
      await pdf.cleanup();
    } catch (error) {
      cleanupFailed = true;
      cleanupError = error;
    }
    try {
      await destroyLoadingTask();
    } catch (error) {
      if (!cleanupFailed) {
        cleanupFailed = true;
        cleanupError = error;
      }
    }
    if (primaryError === undefined && cleanupFailed) {
      throw cleanupError;
    }
  }

  return pages;
};
