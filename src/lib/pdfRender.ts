import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import { buildPngFileName } from "./fileNames";
import type {
  ConversionProgress,
  RenderedPngPage,
} from "../types/conversion";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export type PageSize = {
  width: number;
  height: number;
};

export type RenderPdfOptions = {
  targetLongEdge: number;
  onProgress?: (progress: ConversionProgress) => void;
};

export const getScaleForLongEdge = (
  pageSize: PageSize,
  targetLongEdge: number,
): number => {
  if (targetLongEdge <= 0) {
    throw new Error("targetLongEdge must be greater than 0");
  }

  return targetLongEdge / Math.max(pageSize.width, pageSize.height);
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
  { targetLongEdge, onProgress }: RenderPdfOptions,
): Promise<RenderedPngPage[]> => {
  const data = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data }).promise;

  const pages: RenderedPngPage[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = getScaleForLongEdge(
      {
        width: unscaledViewport.width,
        height: unscaledViewport.height,
      },
      targetLongEdge,
    );
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new Error("캔버스 렌더링 컨텍스트를 만들 수 없습니다.");
    }

    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;

    const blob = await canvasToPngBlob(canvas);
    pages.push({
      pageIndex: pageNumber - 1,
      fileName: buildPngFileName(file.name, pageNumber - 1, doc.numPages),
      blob,
      width: canvas.width,
      height: canvas.height,
    });
    onProgress?.({
      currentPage: pageNumber,
      totalPages: doc.numPages,
    });
  }

  return pages;
};
