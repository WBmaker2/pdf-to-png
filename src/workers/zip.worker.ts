/// <reference lib="webworker" />

import { createZipArchive } from "../lib/zipArchive";
import type { ZipWorkerRequest, ZipWorkerResponse } from "../types/zipWorker";

const worker = self as DedicatedWorkerGlobalScope;
const ZIP_BUILD_ERROR_MESSAGE = "ZIP 파일 생성에 실패했습니다.";

worker.addEventListener("message", async (event: MessageEvent<ZipWorkerRequest>) => {
  if (event.data.type !== "build") {
    return;
  }

  try {
    const blob = await createZipArchive(event.data.pages, (percent) => {
      const message: ZipWorkerResponse = { type: "progress", percent };
      worker.postMessage(message);
    });
    const message: ZipWorkerResponse = { type: "complete", blob };
    worker.postMessage(message);
  } catch {
    const message: ZipWorkerResponse = {
      type: "error",
      message: ZIP_BUILD_ERROR_MESSAGE,
    };
    worker.postMessage(message);
  }
});
