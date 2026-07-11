import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDownloadBlob, downloadBlob } from "./downloads";
import type { RenderedPngPage } from "../types/conversion";

class FakeWorker extends EventTarget {
  postMessage = vi.fn();
  terminate = vi.fn();

  emit(message: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data: message }));
  }
}

const makePages = (): RenderedPngPage[] => [
  {
    pageIndex: 0,
    fileName: "자료-00.png",
    blob: new Blob(["page-0"], { type: "image/png" }),
    width: 1920,
    height: 1080,
  },
  {
    pageIndex: 1,
    fileName: "자료-01.png",
    blob: new Blob(["page-1"], { type: "image/png" }),
    width: 1920,
    height: 1080,
  },
];

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

const stubObjectUrlApis = () => {
  const objectUrl = "blob:download-url";
  const createObjectURL = vi.fn(() => objectUrl);
  const revokeObjectURL = vi.fn();

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  });

  return { createObjectURL, objectUrl, revokeObjectURL };
};

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: originalCreateObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: originalRevokeObjectURL,
  });
  document.body.innerHTML = "";
});

describe("download packager", () => {
  it("returns the single png as-is", async () => {
    const blob = new Blob(["single-image"], { type: "image/png" });
    const pages: RenderedPngPage[] = [
      {
        pageIndex: 0,
        fileName: "자료-00.png",
        blob,
        width: 1920,
        height: 1080,
      },
    ];

    const result = await buildDownloadBlob("자료.pdf", pages);

    expect(result.fileName).toBe("자료-00.png");
    expect(result.blob).toBe(blob);
    expect(result.blob.type).toBe("image/png");
  });

  it("returns a zip download for multiple pages", async () => {
    const pages: RenderedPngPage[] = [
      {
        pageIndex: 0,
        fileName: "자료-00.png",
        blob: new Blob(["page-0"], { type: "image/png" }),
        width: 1920,
        height: 1080,
      },
      {
        pageIndex: 1,
        fileName: "자료-01.png",
        blob: new Blob(["page-1"], { type: "image/png" }),
        width: 1920,
        height: 1080,
      },
    ];

    const worker = new FakeWorker();
    const resultPromise = buildDownloadBlob("자료.pdf", pages, {
      workerFactory: () => worker as unknown as Worker,
    });
    worker.emit({
      type: "progress",
      percent: 50,
    });
    worker.emit({
      type: "complete",
      blob: new Blob(["zip-data"], { type: "application/zip" }),
    });
    const result = await resultPromise;

    expect(result.fileName).toBe("자료-png-1080p.zip");
    expect(result.blob.type).toBe("application/zip");
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "build", pages });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("reports progress from an injected zip worker", async () => {
    const worker = new FakeWorker();
    const onProgress = vi.fn();
    const resultPromise = buildDownloadBlob("자료.pdf", makePages(), {
      onProgress,
      workerFactory: () => worker as unknown as Worker,
    });

    worker.emit({ type: "progress", percent: 42 });
    worker.emit({
      type: "complete",
      blob: new Blob(["zip-data"], { type: "application/zip" }),
    });

    await resultPromise;
    expect(onProgress).toHaveBeenCalledWith(42);
  });

  it("rejects an already-aborted archive request with AbortError", async () => {
    const workerFactory = vi.fn(() => new FakeWorker() as unknown as Worker);
    const controller = new AbortController();
    controller.abort();

    await expect(
      buildDownloadBlob("자료.pdf", makePages(), {
        signal: controller.signal,
        workerFactory,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(workerFactory).not.toHaveBeenCalled();
  });

  it("terminates the injected worker when an archive request is aborted", async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    const resultPromise = buildDownloadBlob("자료.pdf", makePages(), {
      signal: controller.signal,
      workerFactory: () => worker as unknown as Worker,
    });

    controller.abort();

    await expect(resultPromise).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("clicks and cleans up the anchor for direct downloads", () => {
    const blob = new Blob(["image"], { type: "image/png" });
    const { createObjectURL, objectUrl, revokeObjectURL } = stubObjectUrlApis();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    downloadBlob({ fileName: "자료-00.png", blob });

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
    expect(document.body.querySelectorAll("a")).toHaveLength(0);
  });

  it("still cleans up the anchor and object URL when click throws", () => {
    const blob = new Blob(["image"], { type: "image/png" });
    const { objectUrl, revokeObjectURL } = stubObjectUrlApis();
    const clickError = new Error("click failed");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw clickError;
    });

    let thrownError: unknown;
    try {
      downloadBlob({ fileName: "자료-00.png", blob });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBe(clickError);
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
    expect(document.body.querySelectorAll("a")).toHaveLength(0);
  });
});
