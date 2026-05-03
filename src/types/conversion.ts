export type RenderedPngPage = {
  pageIndex: number;
  fileName: string;
  blob: Blob;
  width: number;
  height: number;
};

export type ConversionProgress = {
  currentPage: number;
  totalPages: number;
};
