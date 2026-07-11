import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

type RenderedPngPage = {
  pageIndex: number;
  fileName: string;
  blob: Blob;
  width: number;
  height: number;
};

type RenderPdfModule = {
  renderPdfToPngs: ReturnType<typeof vi.fn>;
};

type DownloadsModule = {
  buildDownloadBlob: ReturnType<typeof vi.fn>;
  downloadBlob: ReturnType<typeof vi.fn>;
};

const makeDeferred = <T,>(): Deferred<T> => {
  let resolvePromise: (value: T) => void = () => {
    throw new Error("deferred resolver was not set");
  };
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
};

const makePngPages = (): RenderedPngPage[] => [
  {
    pageIndex: 0,
    fileName: "수업자료-00.png",
    blob: new Blob(["page-1"], { type: "image/png" }),
    width: 810,
    height: 1080,
  },
];

const createPdf = (name = "수업자료.pdf") =>
  new File(["%PDF-1.7"], name, { type: "application/pdf" });

const loadApp = async ({
  pdfRenderModule,
  onPdfRenderImport = () => undefined,
  downloadsModule,
  onDownloadsImport = () => undefined,
}: {
  pdfRenderModule: RenderPdfModule | Promise<RenderPdfModule>;
  onPdfRenderImport?: () => void;
  downloadsModule: DownloadsModule | Promise<DownloadsModule>;
  onDownloadsImport?: () => void;
}) => {
  vi.resetModules();
  vi.doMock("./lib/pdfRender", () => {
    onPdfRenderImport();
    return pdfRenderModule;
  });
  vi.doMock("./lib/downloads", () => {
    onDownloadsImport();
    return downloadsModule;
  });

  return (await import("./App")).default;
};

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe("App lazy operation guards", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectURL,
    });
  });

  it("does not render when reset wins while the PDF module import is pending", async () => {
    const user = userEvent.setup();
    const pdfModule = makeDeferred<RenderPdfModule>();
    const renderPdfToPngs = vi.fn().mockResolvedValue(makePngPages());
    let importStarted = false;
    const downloadsModule = {
      buildDownloadBlob: vi.fn(),
      downloadBlob: vi.fn(),
    };
    const App = await loadApp({
      pdfRenderModule: pdfModule.promise,
      onPdfRenderImport: () => {
        importStarted = true;
      },
      downloadsModule,
    });

    render(<App />);
    await user.upload(screen.getByLabelText("PDF 파일 선택"), createPdf());
    fireEvent.click(screen.getByRole("button", { name: "PNG로 변환하기" }));
    await waitFor(() => expect(importStarted).toBe(true));

    await user.click(screen.getByRole("button", { name: "변환 취소" }));
    pdfModule.resolve({ renderPdfToPngs });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(renderPdfToPngs).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("PDF 파일을 선택해 주세요.");
  });

  it("does not render when file replacement wins while the PDF module import is pending", async () => {
    const user = userEvent.setup();
    const pdfModule = makeDeferred<RenderPdfModule>();
    const renderPdfToPngs = vi.fn().mockResolvedValue(makePngPages());
    let importStarted = false;
    const App = await loadApp({
      pdfRenderModule: pdfModule.promise,
      onPdfRenderImport: () => {
        importStarted = true;
      },
      downloadsModule: {
        buildDownloadBlob: vi.fn(),
        downloadBlob: vi.fn(),
      },
    });

    render(<App />);
    const input = screen.getByLabelText("PDF 파일 선택");
    await user.upload(input, createPdf());
    fireEvent.click(screen.getByRole("button", { name: "PNG로 변환하기" }));
    await waitFor(() => expect(importStarted).toBe(true));

    input.removeAttribute("disabled");
    fireEvent.change(input, { target: { files: [createPdf("새자료.pdf")] } });
    await screen.findByText("새자료.pdf");
    pdfModule.resolve({ renderPdfToPngs });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(renderPdfToPngs).not.toHaveBeenCalled();
    expect(screen.getByText("새자료.pdf")).toBeVisible();
    expect(screen.queryByText("수업자료-00.png")).not.toBeInTheDocument();
  });

  it("does not build a download when reset wins while the download module import is pending", async () => {
    const user = userEvent.setup();
    const renderPdfToPngs = vi.fn().mockResolvedValue(makePngPages());
    const downloadsModule = makeDeferred<DownloadsModule>();
    const buildDownloadBlob = vi.fn().mockResolvedValue({
      fileName: "수업자료-png-1080px.zip",
      blob: new Blob(["zip-data"], { type: "application/zip" }),
    });
    let importStarted = false;
    const App = await loadApp({
      pdfRenderModule: { renderPdfToPngs },
      downloadsModule: downloadsModule.promise,
      onDownloadsImport: () => {
        importStarted = true;
      },
    });

    render(<App />);
    await user.upload(screen.getByLabelText("PDF 파일 선택"), createPdf());
    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));
    await screen.findByText("수업자료-00.png");
    fireEvent.click(screen.getByRole("button", { name: /PNG 다운로드|ZIP 다운로드/ }));
    await waitFor(() => expect(importStarted).toBe(true));

    await user.click(screen.getByRole("button", { name: "초기화" }));
    downloadsModule.resolve({
      buildDownloadBlob,
      downloadBlob: vi.fn(),
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(buildDownloadBlob).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("PDF 파일을 선택해 주세요.");
  });

  it("does not build a download when file replacement wins while the download module import is pending", async () => {
    const user = userEvent.setup();
    const renderPdfToPngs = vi.fn().mockResolvedValue(makePngPages());
    const downloadsModule = makeDeferred<DownloadsModule>();
    const buildDownloadBlob = vi.fn();
    let importStarted = false;
    const App = await loadApp({
      pdfRenderModule: { renderPdfToPngs },
      downloadsModule: downloadsModule.promise,
      onDownloadsImport: () => {
        importStarted = true;
      },
    });

    render(<App />);
    const input = screen.getByLabelText("PDF 파일 선택");
    await user.upload(input, createPdf());
    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));
    await screen.findByText("수업자료-00.png");
    fireEvent.click(screen.getByRole("button", { name: "PNG 다운로드" }));
    await waitFor(() => expect(importStarted).toBe(true));

    input.removeAttribute("disabled");
    fireEvent.change(input, { target: { files: [createPdf("새자료.pdf")] } });
    await screen.findByText("새자료.pdf");
    downloadsModule.resolve({
      buildDownloadBlob,
      downloadBlob: vi.fn(),
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(buildDownloadBlob).not.toHaveBeenCalled();
    expect(screen.getByText("새자료.pdf")).toBeVisible();
    expect(screen.queryByText("수업자료-00.png")).not.toBeInTheDocument();
  });

  it("starts only one conversion for forced rapid duplicate events", async () => {
    const user = userEvent.setup();
    const conversion = makeDeferred<RenderedPngPage[]>();
    const renderPdfToPngs = vi.fn().mockReturnValue(conversion.promise);
    const App = await loadApp({
      pdfRenderModule: { renderPdfToPngs },
      downloadsModule: {
        buildDownloadBlob: vi.fn(),
        downloadBlob: vi.fn(),
      },
    });

    render(<App />);
    await user.upload(screen.getByLabelText("PDF 파일 선택"), createPdf());
    const convertButton = screen.getByRole("button", { name: "PNG로 변환하기" });
    fireEvent.click(convertButton);
    convertButton.removeAttribute("disabled");
    fireEvent.click(convertButton);

    await waitFor(() => {
      expect(renderPdfToPngs).toHaveBeenCalledTimes(1);
    });
    conversion.resolve(makePngPages());
    expect(await screen.findByText("수업자료-00.png")).toBeVisible();
  });
});
