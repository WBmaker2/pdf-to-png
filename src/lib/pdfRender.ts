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

  const destroyLoadingTask = async () => {
    if (typeof loadingTask.destroy === "function") {
      await loadingTask.destroy();
    }
  };
  const handleLoadingAbort = () => {
    void destroyLoadingTask();
  };
  signal?.addEventListener("abort", handleLoadingAbort, { once: true });

  let doc: pdfjsLib.PDFDocumentProxy | null = null;
  try {
    doc = await loadingTask.promise;
  } catch (error) {
    signal?.removeEventListener("abort", handleLoadingAbort);
    if (signal?.aborted) {
      throw createAbortError();
    }
    await destroyLoadingTask();
    throw error;
  }
  signal?.removeEventListener("abort", handleLoadingAbort);
  throwIfAborted(signal);

  if (!doc) {
    await destroyLoadingTask();
    throw new Error("pdf 문서 로드에 실패했습니다.");
  }

  const pdf = doc;
  const pages: RenderedPngPage[] = [];
  let renderedBytes = 0;
  try {
    assertPdfPageCount(pdf.numPages);

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      throwIfAborted(signal);
      let page: pdfjsLib.PDFPageProxy | null = null;
      let canvas: HTMLCanvasElement | null = null;

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
      } finally {
        if (typeof page?.cleanup === "function") {
          page.cleanup();
        }
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
      }
    }
  } finally {
    try {
      await pdf.cleanup();
    } finally {
      await destroyLoadingTask();
    }
  }

  return pages;
};
