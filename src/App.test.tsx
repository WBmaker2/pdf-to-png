import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/pdfRender", () => ({ renderPdfToPngs: vi.fn() }));
vi.mock("./lib/downloads", () => ({
  buildDownloadBlob: vi.fn(),
  downloadBlob: vi.fn(),
}));
import { buildDownloadBlob, downloadBlob } from "./lib/downloads";
import { renderPdfToPngs } from "./lib/pdfRender";
import App from "./App";

const makePngPages = () => [
  {
    pageIndex: 0,
    fileName: "수업자료-00.png",
    blob: new Blob(["page-1"], { type: "image/png" }),
    width: 810,
    height: 1080,
  },
  {
    pageIndex: 1,
    fileName: "수업자료-01.png",
    blob: new Blob(["page-2"], { type: "image/png" }),
    width: 810,
    height: 1080,
  },
];

const mockRenderPdfToPngs = vi.mocked(renderPdfToPngs);
const mockBuildDownloadBlob = vi.mocked(buildDownloadBlob);
const mockDownloadBlob = vi.mocked(downloadBlob);

const createPdf = () =>
  new File(["pdf"], "수업자료.pdf", {
    type: "application/pdf",
  });

describe("App", () => {
  beforeEach(() => {
    mockRenderPdfToPngs.mockReset();
    mockBuildDownloadBlob.mockReset();
    mockDownloadBlob.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("선택한 PDF를 2페이지 PNG로 변환한다", async () => {
    const user = userEvent.setup();
    const pages = makePngPages();
    mockRenderPdfToPngs.mockResolvedValue(pages);

    render(<App />);

    const input = screen.getByLabelText("PDF 파일 선택");
    const pdfFile = createPdf();
    await user.upload(input, pdfFile);

    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));

    expect(await screen.findByText("수업자료-00.png")).toBeInTheDocument();
    expect(screen.getByText("수업자료-01.png")).toBeInTheDocument();

    const [calledFile, calledOptions] = mockRenderPdfToPngs.mock.calls[0];
    expect(calledFile?.name).toBe("수업자료.pdf");
    expect(calledOptions).toMatchObject({ targetLongEdge: 1080 });
  });

  it("변환 후 ZIP 파일로 다운로드를 수행한다", async () => {
    const user = userEvent.setup();
    const pages = makePngPages();
    mockRenderPdfToPngs.mockResolvedValue(pages);
    mockBuildDownloadBlob.mockResolvedValue({
      fileName: "수업자료-png-1080p.zip",
      blob: new Blob(["zip-data"], { type: "application/zip" }),
    });

    render(<App />);

    await user.upload(screen.getByLabelText("PDF 파일 선택"), createPdf());
    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));

    await screen.findByText("수업자료-00.png");
    await user.click(screen.getByRole("button", { name: "ZIP 다운로드" }));

    expect(mockBuildDownloadBlob).toHaveBeenCalledWith(
      "수업자료.pdf",
      pages,
      expect.objectContaining({
        onProgress: expect.any(Function),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(mockDownloadBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "수업자료-png-1080p.zip",
      }),
    );
  });

  it("ZIP 생성 중에는 반복 다운로드를 막고 진행률을 표시한다", async () => {
    const user = userEvent.setup();
    const pages = makePngPages();
    mockRenderPdfToPngs.mockResolvedValue(pages);
    let resolveDownload: (download: { fileName: string; blob: Blob }) => void = () => {
      throw new Error("download resolver was not set");
    };
    mockBuildDownloadBlob.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDownload = resolve;
        }),
    );

    render(<App />);

    await user.upload(screen.getByLabelText("PDF 파일 선택"), createPdf());
    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));
    await screen.findByText("수업자료-00.png");

    const downloadButton = screen.getByRole("button", { name: "ZIP 다운로드" });
    fireEvent.click(downloadButton);
    fireEvent.click(downloadButton);

    expect(mockBuildDownloadBlob).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: /ZIP 생성 중/ }),
    ).toBeDisabled();

    const options = mockBuildDownloadBlob.mock.calls[0][2];
    act(() => {
      options?.onProgress?.(60);
    });
    expect(screen.getByRole("button", { name: "ZIP 생성 중 60%" })).toBeDisabled();

    resolveDownload({
      fileName: "수업자료-png-1080p.zip",
      blob: new Blob(["zip-data"], { type: "application/zip" }),
    });

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalledTimes(1);
    });
  });

  it("변환 중 초기화하면 이전 변환 결과를 무시한다", async () => {
    const user = userEvent.setup();
    let resolveConversion: (pages: ReturnType<typeof makePngPages>) => void = () => {
      throw new Error("conversion resolver was not set");
    };

    mockRenderPdfToPngs.mockReturnValue(
      new Promise((resolve) => {
        resolveConversion = resolve;
      }),
    );

    render(<App />);

    await user.upload(screen.getByLabelText("PDF 파일 선택"), createPdf());
    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));
    await user.click(screen.getByRole("button", { name: "초기화" }));

    expect(mockRenderPdfToPngs.mock.calls[0][1].signal?.aborted).toBe(true);
    resolveConversion(makePngPages());

    await waitFor(() => {
      expect(screen.queryByText("수업자료-00.png")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("status")).toHaveTextContent("PDF 파일을 선택해 주세요.");
  });

  it("다운로드 오류를 상태 메시지로 표시한다", async () => {
    const user = userEvent.setup();
    const pages = makePngPages();
    mockRenderPdfToPngs.mockResolvedValue(pages);
    mockBuildDownloadBlob.mockRejectedValue(new Error("ZIP 생성에 실패했습니다."));

    render(<App />);

    await user.upload(screen.getByLabelText("PDF 파일 선택"), createPdf());
    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));
    await screen.findByText("수업자료-00.png");
    await user.click(screen.getByRole("button", { name: "ZIP 다운로드" }));

    await waitFor(() => {
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("ZIP 생성에 실패했습니다.");
      expect(status).toBeVisible();
    });
  });

  it("변환 진행 상황을 상태 메시지로 알린다", async () => {
    const user = userEvent.setup();
    const pages = makePngPages();
    mockRenderPdfToPngs.mockImplementation(async (_file, options) => {
      options.onProgress?.({ currentPage: 1, totalPages: 2 });
      return pages;
    });

    render(<App />);

    await user.upload(screen.getByLabelText("PDF 파일 선택"), createPdf());
    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "2개의 PNG 파일이 준비되었습니다.",
      );
    });
    expect(screen.getByText("수업자료-00.png")).toBeInTheDocument();
    expect(screen.getByText("긴 변 1080px PNG로 변환합니다.")).toBeInTheDocument();
  });

  it("PDF가 아닌 파일을 업로드하면 상태 메시지를 표시한다", async () => {
    const user = userEvent.setup({ applyAccept: false });

    render(<App />);

    await user.upload(
      screen.getByLabelText("PDF 파일 선택"),
      new File(["note"], "memo.txt", {
        type: "text/plain",
      }),
    );

    await waitFor(() => {
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("PDF 파일만 선택할 수 있습니다.");
      expect(status).toBeVisible();
    });
  });
});
