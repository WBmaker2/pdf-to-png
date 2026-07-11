import type { RenderedPngPage } from "../types/conversion";
import type { ZipWorkerResponse } from "../types/zipWorker";
import { buildZipFileName } from "./fileNames";

export type DownloadBlob = {
  fileName: string;
  blob: Blob;
};

export type BuildDownloadOptions = {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  workerFactory?: () => Worker;
};

const createAbortError = () => new DOMException("ZIP 생성이 취소되었습니다.", "AbortError");
const ZIP_BUILD_ERROR_MESSAGE = "ZIP 파일 생성에 실패했습니다.";

const createZipWorker = () =>
  new Worker(new URL("../workers/zip.worker.ts", import.meta.url), {
    type: "module",
  });

const buildZipBlob = (
  pages: RenderedPngPage[],
  { signal, onProgress, workerFactory }: BuildDownloadOptions,
): Promise<Blob> => {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = (workerFactory ?? createZipWorker)();
    } catch {
      reject(new Error(ZIP_BUILD_ERROR_MESSAGE));
      return;
    }
    let isSettled = false;

    const cleanup = () => {
      signal?.removeEventListener("abort", handleAbort);
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
    };

    const settle = (callback: () => void) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      cleanup();
      callback();
    };

    const handleAbort = () => {
      settle(() => reject(createAbortError()));
    };

    const handleMessage = (event: MessageEvent<ZipWorkerResponse>) => {
      const message = event.data;

      if (message.type === "progress") {
        onProgress?.(message.percent);
        return;
      }

      if (message.type === "complete") {
        settle(() => resolve(message.blob));
        return;
      }

      settle(() => reject(new Error(ZIP_BUILD_ERROR_MESSAGE)));
    };

    const handleError = () => {
      settle(() => reject(new Error(ZIP_BUILD_ERROR_MESSAGE)));
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    signal?.addEventListener("abort", handleAbort, { once: true });
    try {
      worker.postMessage({ type: "build", pages });
    } catch {
      settle(() => reject(new Error(ZIP_BUILD_ERROR_MESSAGE)));
    }
  });
};

export const buildDownloadBlob = async (
  originalFileName: string,
  pages: RenderedPngPage[],
  options: BuildDownloadOptions = {},
): Promise<DownloadBlob> => {
  if (options.signal?.aborted) {
    throw createAbortError();
  }

  if (pages.length === 0) {
    throw new Error("다운로드할 PNG가 없습니다.");
  }

  if (pages.length === 1) {
    const page = pages[0];
    return { fileName: page.fileName, blob: page.blob };
  }

  const zipBlob = await buildZipBlob(pages, options);

  return {
    fileName: buildZipFileName(originalFileName),
    blob: zipBlob,
  };
};

export const downloadBlob = (download: DownloadBlob): void => {
  const objectUrl = URL.createObjectURL(download.blob);
  const link = document.createElement("a");

  try {
    link.href = objectUrl;
    link.download = download.fileName;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }
};
