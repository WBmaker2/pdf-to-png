export type PageSize = {
  width: number;
  height: number;
};

export const getScaleForLongEdge = (
  pageSize: PageSize,
  targetLongEdge: number,
): number => {
  if (!Number.isFinite(targetLongEdge) || targetLongEdge <= 0) {
    throw new Error("targetLongEdge must be greater than 0");
  }

  if (
    !Number.isFinite(pageSize.width) ||
    !Number.isFinite(pageSize.height) ||
    pageSize.width <= 0 ||
    pageSize.height <= 0
  ) {
    throw new Error("pageSize must have finite, positive width and height");
  }

  return targetLongEdge / Math.max(pageSize.width, pageSize.height);
};
