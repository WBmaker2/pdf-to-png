import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getScaleForLongEdge } from "./pageScale";

const pdfjsMock = vi.hoisted(() => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(),
}));

vi.mock("pdfjs-dist", () => pdfjsMock);

import { renderPdfToPngs, waitForAbortable } from "./pdfRender";

type LoadingTaskMock = {
  promise: Promise<unknown>;
  destroy: ReturnType<typeof vi.fn>;
};

type PageMock = {
  cleanup: ReturnType<typeof vi.fn>;
  getViewport: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
};

type PdfMock = {
  cleanup: ReturnType<typeof vi.fn>;
  getPage: ReturnType<typeof vi.fn>;
  numPages: number;
};

const createDeferred = <T,>() => {
  let resolve: (value: T) => void = () => {
    throw new Error("resolver was not set");
  };
  let reject: (error: unknown) => void = () => {
    throw new Error("rejecter was not set");
  };
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
};

const createCanvas = (
  toBlob: (callback: BlobCallback) => void = (callback) => {
    callback(new Blob(["png"], { type: "image/png" }));
  },
) => {
  const context = {
    fillRect: vi.fn(),
    fillStyle: "",
  } as unknown as CanvasRenderingContext2D;
  const canvas = {
    getContext: vi.fn(() => context),
    toBlob: vi.fn(toBlob),
    width: 0,
    height: 0,
  } as unknown as HTMLCanvasElement;

  return { canvas, context };
};

const createDelayedBlobCanvas = () => {
  let resolveToBlob: BlobCallback = () => {
    throw new Error("toBlob callback was not set");
  };
  const { canvas, context } = createCanvas((callback) => {
    resolveToBlob = callback;
  });

  return { canvas, context, resolveToBlob: (blob: Blob | null) => resolveToBlob(blob) };
};

const createPage = (renderTask: { promise: Promise<unknown>; cancel: ReturnType<typeof vi.fn> }) => ({
  cleanup: vi.fn(),
  getViewport: vi.fn(({ scale }: { scale: number }) => ({
    width: 612 * scale,
    height: 792 * scale,
  })),
  render: vi.fn(() => renderTask),
});

const createPdf = (page: PageMock): PdfMock => ({
  cleanup: vi.fn(),
  getPage: vi.fn().mockResolvedValue(page),
  numPages: 1,
});

const createLoadingTask = (
  pdf: PdfMock,
  destroy: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined),
  documentLoad = createDeferred<PdfMock>(),
  resolveDocument = true,
): LoadingTaskMock => {
  const task = {
    promise: documentLoad.promise,
    destroy,
  };
  if (resolveDocument) {
    documentLoad.resolve(pdf);
  }
  return task;
};

const renderOptions = (signal: AbortSignal) => ({
  signal,
  targetLongEdge: 1080,
});

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

let originalCreateElement: typeof document.createElement;

beforeEach(() => {
  pdfjsMock.getDocument.mockReset();
  originalCreateElement = document.createElement.bind(document);
});

afterEach(() => {
  document.createElement = originalCreateElement;
});

describe("getScaleForLongEdge", () => {
  it("computes scale by long edge for portrait page", () => {
    expect(getScaleForLongEdge({ width: 612, height: 792 }, 1080)).toBeCloseTo(
      1.3636,
      4,
    );
  });

  it("computes scale by long edge for landscape page", () => {
    expect(getScaleForLongEdge({ width: 792, height: 612 }, 1080)).toBeCloseTo(
      1.3636,
      4,
    );
  });

  it("throws when targetLongEdge is zero", () => {
    expect(() => getScaleForLongEdge({ width: 612, height: 792 }, 0)).toThrow(
      /targetLongEdge/,
    );
  });

  it("throws when targetLongEdge is NaN", () => {
    expect(() =>
      getScaleForLongEdge({ width: 612, height: 792 }, Number.NaN),
    ).toThrow(/targetLongEdge/);
  });

  it("throws when targetLongEdge is Infinity", () => {
    expect(() =>
      getScaleForLongEdge({ width: 612, height: 792 }, Number.POSITIVE_INFINITY),
    ).toThrow(/targetLongEdge/);
  });

  it("throws when page width is invalid", () => {
    expect(() =>
      getScaleForLongEdge(
        { width: Number.NaN, height: 792 },
        1080,
      ),
    ).toThrow(/pageSize/);
  });

  it("throws when page height is non-positive", () => {
    expect(() =>
      getScaleForLongEdge({ width: 612, height: 0 }, 1080),
    ).toThrow(/pageSize/);
  });
});

describe("waitForAbortable", () => {
  it("rejects an already-aborted operation without starting it", async () => {
    const controller = new AbortController();
    const operation = vi.fn().mockResolvedValue("done");
    controller.abort();

    await expect(waitForAbortable(operation, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(operation).not.toHaveBeenCalled();
  });

  it("removes its abort listener when the operation settles", async () => {
    const controller = new AbortController();
    const removeEventListener = vi.spyOn(controller.signal, "removeEventListener");

    await expect(
      waitForAbortable(() => Promise.resolve("done"), controller.signal),
    ).resolves.toBe("done");

    expect(removeEventListener).toHaveBeenCalledTimes(1);
  });

  it("handles a late rejection after abort", async () => {
    const controller = new AbortController();
    const operation = createDeferred<string>();
    const result = waitForAbortable(() => operation.promise, controller.signal);

    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });

    operation.reject(new Error("late operation failure"));
    await flushPromises();
  });
});

describe("renderPdfToPngs lifecycle", () => {
  it("rejects promptly and cleans up when getPage never resolves after abort", async () => {
    const page = createPage({ cancel: vi.fn(), promise: Promise.resolve() });
    const pdf = createPdf(page);
    const getPageDeferred = createDeferred<PageMock>();
    pdf.getPage.mockReturnValue(getPageDeferred.promise);
    const destroy = vi.fn().mockResolvedValue(undefined);
    const loadingTask = createLoadingTask(pdf, destroy);
    pdfjsMock.getDocument.mockReturnValue(loadingTask);
    const controller = new AbortController();
    const renderPromise = renderPdfToPngs(
      new File(["pdf"], "sample.pdf"),
      renderOptions(controller.signal),
    );

    await vi.waitFor(() => expect(pdf.getPage).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(renderPromise).rejects.toMatchObject({ name: "AbortError" });
    expect(pdf.cleanup).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("rejects promptly and cleans up when toBlob callback is delayed after abort", async () => {
    const renderTask = { cancel: vi.fn(), promise: Promise.resolve() };
    const page = createPage(renderTask);
    const pdf = createPdf(page);
    const destroy = vi.fn().mockResolvedValue(undefined);
    const loadingTask = createLoadingTask(pdf, destroy);
    pdfjsMock.getDocument.mockReturnValue(loadingTask);
    const delayedCanvas = createDelayedBlobCanvas();
    document.createElement = vi.fn(() => delayedCanvas.canvas) as typeof document.createElement;
    const controller = new AbortController();
    const renderPromise = renderPdfToPngs(
      new File(["pdf"], "sample.pdf"),
      renderOptions(controller.signal),
    );

    await vi.waitFor(() => expect(delayedCanvas.canvas.toBlob).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(renderPromise).rejects.toMatchObject({ name: "AbortError" });
    expect(page.cleanup).toHaveBeenCalledTimes(1);
    expect(pdf.cleanup).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);

    delayedCanvas.resolveToBlob(new Blob(["late-png"], { type: "image/png" }));
    await flushPromises();
  });

  it("destroys the loading task once when abort happens immediately after document load", async () => {
    const page = createPage({ cancel: vi.fn(), promise: Promise.resolve() });
    const pdf = createPdf(page);
    const documentLoad = createDeferred<PdfMock>();
    const destroyDeferred = createDeferred<void>();
    const destroy = vi.fn(() => destroyDeferred.promise);
    const loadingTask = createLoadingTask(pdf, destroy, documentLoad, false);
    pdfjsMock.getDocument.mockReturnValue(loadingTask);
    const controller = new AbortController();
    const renderPromise = renderPdfToPngs(
      new File(["pdf"], "sample.pdf"),
      renderOptions(controller.signal),
    );

    await vi.waitFor(() => expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(1));
    documentLoad.resolve(pdf);
    controller.abort();
    expect(destroy).toHaveBeenCalledTimes(1);

    destroyDeferred.resolve();
    await expect(renderPromise).rejects.toMatchObject({ name: "AbortError" });
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(pdf.cleanup).toHaveBeenCalledTimes(1);
  });

  it("observes a loading abort destroy rejection without replacing AbortError", async () => {
    const page = createPage({ cancel: vi.fn(), promise: Promise.resolve() });
    const pdf = createPdf(page);
    const getPageDeferred = createDeferred<PageMock>();
    pdf.getPage.mockReturnValue(getPageDeferred.promise);
    const destroy = vi.fn().mockRejectedValue(new Error("destroy failed"));
    const loadingTask = createLoadingTask(pdf, destroy);
    pdfjsMock.getDocument.mockReturnValue(loadingTask);
    const controller = new AbortController();
    const renderPromise = renderPdfToPngs(
      new File(["pdf"], "sample.pdf"),
      renderOptions(controller.signal),
    );

    await vi.waitFor(() => expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(1));
    controller.abort();
    getPageDeferred.resolve(page);

    await expect(renderPromise).rejects.toMatchObject({ name: "AbortError" });
    await flushPromises();
    expect(page.cleanup).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("keeps AbortError when render and document cleanup methods fail", async () => {
    const renderDeferred = createDeferred<void>();
    const renderTask = { cancel: vi.fn(), promise: renderDeferred.promise };
    const page = createPage(renderTask);
    page.cleanup.mockRejectedValue(new Error("page cleanup failed"));
    const pdf = createPdf(page);
    pdf.cleanup.mockRejectedValue(new Error("pdf cleanup failed"));
    const destroy = vi.fn().mockResolvedValue(undefined);
    const loadingTask = createLoadingTask(pdf, destroy);
    pdfjsMock.getDocument.mockReturnValue(loadingTask);
    const controller = new AbortController();
    const { canvas } = createCanvas();
    document.createElement = vi.fn(() => canvas) as typeof document.createElement;
    const renderPromise = renderPdfToPngs(
      new File(["pdf"], "sample.pdf"),
      renderOptions(controller.signal),
    );

    await vi.waitFor(() => expect(page.render).toHaveBeenCalledTimes(1));
    controller.abort();
    renderDeferred.reject(new Error("render cancelled"));

    await expect(renderPromise).rejects.toMatchObject({ name: "AbortError" });
    expect(renderTask.cancel).toHaveBeenCalledTimes(1);
    expect(page.cleanup).toHaveBeenCalledTimes(1);
    expect(pdf.cleanup).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it("propagates a document cleanup failure after an otherwise successful render", async () => {
    const page = createPage({ cancel: vi.fn(), promise: Promise.resolve() });
    const pdf = createPdf(page);
    const cleanupError = new Error("pdf cleanup failed");
    pdf.cleanup.mockRejectedValue(cleanupError);
    const destroy = vi.fn().mockResolvedValue(undefined);
    const loadingTask = createLoadingTask(pdf, destroy);
    pdfjsMock.getDocument.mockReturnValue(loadingTask);
    const { canvas } = createCanvas();
    document.createElement = vi.fn(() => canvas) as typeof document.createElement;

    await expect(
      renderPdfToPngs(new File(["pdf"], "sample.pdf"), {
        targetLongEdge: 1080,
      }),
    ).rejects.toBe(cleanupError);
    expect(page.cleanup).toHaveBeenCalledTimes(1);
    expect(pdf.cleanup).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("preserves the primary render error when all cleanup operations fail", async () => {
    const renderError = new Error("render failed");
    const renderDeferred = createDeferred<void>();
    const renderTask = { cancel: vi.fn(), promise: renderDeferred.promise };
    const page = createPage(renderTask);
    page.cleanup.mockRejectedValue(new Error("page cleanup failed"));
    const pdf = createPdf(page);
    pdf.cleanup.mockRejectedValue(new Error("pdf cleanup failed"));
    const destroy = vi.fn().mockRejectedValue(new Error("destroy failed"));
    const loadingTask = createLoadingTask(pdf, destroy);
    pdfjsMock.getDocument.mockReturnValue(loadingTask);
    const { canvas } = createCanvas();
    document.createElement = vi.fn(() => canvas) as typeof document.createElement;

    const renderPromise = renderPdfToPngs(new File(["pdf"], "sample.pdf"), {
      targetLongEdge: 1080,
    });
    await vi.waitFor(() => expect(page.render).toHaveBeenCalledTimes(1));
    renderDeferred.reject(renderError);

    await expect(renderPromise).rejects.toBe(renderError);
    expect(page.cleanup).toHaveBeenCalledTimes(1);
    expect(pdf.cleanup).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
