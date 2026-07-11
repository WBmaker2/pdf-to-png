import type { RenderedPngPage } from "./conversion";

export type ZipWorkerRequest = {
  type: "build";
  pages: RenderedPngPage[];
};

export type ZipWorkerProgressMessage = {
  type: "progress";
  percent: number;
};

export type ZipWorkerCompleteMessage = {
  type: "complete";
  blob: Blob;
};

export type ZipWorkerErrorMessage = {
  type: "error";
  message: string;
};

export type ZipWorkerResponse =
  | ZipWorkerProgressMessage
  | ZipWorkerCompleteMessage
  | ZipWorkerErrorMessage;
