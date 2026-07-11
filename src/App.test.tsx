import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/pdfRender", () => ({ renderPdfToPngs: vi.fn() }));
vi.mock("./lib/downloads", () => ({
  buildDownloadBlob: vi.fn(),
  downloadBlob: vi.fn(),
}));
vi.mock("./lib/pdfValidation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/pdfValidation")>();

  return { ...actual, validatePdfFile: vi.fn() };
});
import { buildDownloadBlob, downloadBlob } from "./lib/downloads";
import { renderPdfToPngs } from "./lib/pdfRender";
import { PdfValidationError, validatePdfFile } from "./lib/pdfValidation";
import App from "./App";

if (!Blob.prototype.text) {
  Blob.prototype.text = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("error", () => reject(reader.error));
      reader.addEventListener("load", () => resolve(reader.result as string));
      reader.readAsText(this);
    });
  };
}

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
const mockValidatePdfFile = vi.mocked(validatePdfFile);
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const defaultCreateObjectURL = vi.fn(() => "blob:preview-default");
const defaultRevokeObjectURL = vi.fn();

const createPdf = () =>
  new File(["%PDF-1.7"], "수업자료.pdf", {
    type: "application/pdf",
  });

const createDeferredPdf = (name = "수업자료.pdf") => {
  let resolveHeader: (header: string) => void = () => {
    throw new Error("header resolver was not set");
  };
  let rejectHeader: (error: Error) => void = () => {
    throw new Error("header rejecter was not set");
  };
  const header = new Promise<string>((resolve, reject) => {
    resolveHeader = resolve;
    rejectHeader = reject;
  });
  void header.catch(() => undefined);
  const file = new File(["deferred"], name, { type: "application/pdf" });

  Object.defineProperty(file, "slice", {
    value: () => ({ text: () => header }) as Blob,
  });

  return { file, rejectHeader, resolveHeader };
};

describe("App", () => {
  beforeEach(() => {
    mockRenderPdfToPngs.mockReset();
    mockBuildDownloadBlob.mockReset();
    mockDownloadBlob.mockReset();
    mockValidatePdfFile.mockReset();
    defaultCreateObjectURL.mockClear();
    defaultRevokeObjectURL.mockClear();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: defaultCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: defaultRevokeObjectURL,
    });
    mockValidatePdfFile.mockImplementation(async (file) => {
      const { validatePdfFile: actualValidatePdfFile } = await vi.importActual<
        typeof import("./lib/pdfValidation")
      >("./lib/pdfValidation");

      return actualValidatePdfFile(file);
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
      fileName: "수업자료-png-1080px.zip",
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
        fileName: "수업자료-png-1080px.zip",
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
    expect(
      screen.getByRole("progressbar", { name: "ZIP 파일 생성 진행률" }),
    ).toHaveAttribute("value", "60");
    expect(
      screen.getByRole("progressbar", { name: "ZIP 파일 생성 진행률" }),
    ).toHaveAttribute("max", "100");

    resolveDownload({
      fileName: "수업자료-png-1080px.zip",
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
    await user.click(screen.getByRole("button", { name: "변환 취소" }));

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
    mockBuildDownloadBlob.mockRejectedValue(new Error("raw JSZip failure"));

    render(<App />);

    await user.upload(screen.getByLabelText("PDF 파일 선택"), createPdf());
    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));
    await screen.findByText("수업자료-00.png");
    await user.click(screen.getByRole("button", { name: "ZIP 다운로드" }));

    await waitFor(() => {
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("ZIP 파일 생성에 실패했습니다.");
      expect(status).toBeVisible();
    });
  });

  it("변환 진행 상황을 native progress로 알린다", async () => {
    const user = userEvent.setup();
    const pages = makePngPages();
    let resolveConversion: (pages: ReturnType<typeof makePngPages>) => void = () => {
      throw new Error("conversion resolver was not set");
    };
    mockRenderPdfToPngs.mockImplementation(
      (_file, options) =>
        new Promise((resolve) => {
          resolveConversion = resolve;
          options.onProgress?.({ currentPage: 1, totalPages: 2 });
        }),
    );

    render(<App />);

    await user.upload(screen.getByLabelText("PDF 파일 선택"), createPdf());
    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));

    expect(screen.getByRole("progressbar", { name: "PDF 변환 진행률" })).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    expect(screen.getByLabelText("변환 설정")).toHaveAttribute("aria-busy", "true");
    const conversionStatus = document.querySelector(".conversion-progress [role='status']");
    expect(conversionStatus).toHaveTextContent("1 / 2 페이지 변환 중");
    expect(document.querySelector(".status-message")).not.toBeInTheDocument();

    resolveConversion(pages);
    await screen.findByText("수업자료-00.png");
    expect(screen.queryByText(/\b1080p\b/)).not.toBeInTheDocument();
  });

  it("초기화 전에는 파일이나 작업이 없으면 비활성화한다", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "초기화" })).toBeDisabled();
    expect(screen.getByText(/50MB 이하 · 최대 50페이지/)).toBeVisible();
  });

  it("유효한 PDF를 드롭하면 검증 후 파일 메타데이터를 표시한다", async () => {
    render(<App />);

    fireEvent.drop(screen.getByLabelText("PDF 업로드"), {
      dataTransfer: {
        files: [createPdf()],
        types: ["Files"],
      },
    });

    expect(await screen.findByText("수업자료.pdf")).toBeVisible();
    expect(screen.getByText("8 B")).toBeVisible();
  });

  it("파일 선택 상태는 메타데이터로만 표시한다", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(screen.getByLabelText("PDF 파일 선택"), createPdf());

    const selectedFileMetadata = (await screen.findByText("수업자료.pdf")).closest(
      ".selected-file",
    );
    expect(selectedFileMetadata).toBeInTheDocument();
    expect(document.querySelector(".status-message")).not.toBeInTheDocument();
  });

  it("결과 미리보기는 성공 상태를 별도 상태 공지에 반복하지 않는다", async () => {
    const user = userEvent.setup();
    mockRenderPdfToPngs.mockResolvedValue(makePngPages());

    render(<App />);

    await user.upload(screen.getByLabelText("PDF 파일 선택"), createPdf());
    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));

    expect(await screen.findByAltText("수업자료-00.png 미리보기")).toBeVisible();
    expect(screen.getByText("2개의 PNG 파일이 준비되었습니다.").closest(".result-panel")).toBeInTheDocument();
    expect(document.querySelector(".status-message")).not.toBeInTheDocument();
  });

  it("교체 파일 검증 중에는 이전 파일의 변환과 다운로드를 막고 완료 후 새 파일로 전환한다", async () => {
    const user = userEvent.setup();
    const replacement = createDeferredPdf("새자료.pdf");
    mockRenderPdfToPngs.mockResolvedValue(makePngPages());

    render(<App />);

    const input = screen.getByLabelText("PDF 파일 선택");
    await user.upload(input, createPdf());
    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));
    await screen.findByText("수업자료-00.png");

    fireEvent.change(input, { target: { files: [replacement.file] } });

    const convertButton = screen.getByRole("button", { name: "PNG로 변환하기" });
    const downloadButton = screen.getByRole("button", { name: "ZIP 다운로드" });
    expect(convertButton).toBeDisabled();
    expect(downloadButton).toBeDisabled();

    downloadButton.removeAttribute("disabled");
    fireEvent.click(downloadButton);
    convertButton.removeAttribute("disabled");
    fireEvent.click(convertButton);
    expect(mockBuildDownloadBlob).not.toHaveBeenCalled();
    expect(mockRenderPdfToPngs).toHaveBeenCalledTimes(1);

    replacement.resolveHeader("%PDF-1.7");

    await waitFor(() => {
      expect(screen.getByText("새자료.pdf")).toBeVisible();
      expect(screen.getByRole("button", { name: "PNG로 변환하기" })).not.toBeDisabled();
      expect(screen.queryByRole("button", { name: "ZIP 다운로드" })).not.toBeInTheDocument();
    });
  });

  it("교체 파일 검증이 실패하면 이전 파일의 변환과 다운로드를 다시 허용한다", async () => {
    const user = userEvent.setup();
    const replacement = createDeferredPdf("손상자료.pdf");
    mockRenderPdfToPngs.mockResolvedValue(makePngPages());

    render(<App />);

    const input = screen.getByLabelText("PDF 파일 선택");
    await user.upload(input, createPdf());
    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));
    await screen.findByText("수업자료-00.png");

    fireEvent.change(input, { target: { files: [replacement.file] } });
    expect(screen.getByRole("button", { name: "PNG로 변환하기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "ZIP 다운로드" })).toBeDisabled();

    await act(async () => {
      replacement.rejectHeader(new Error("signature read failed"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "PNG로 변환하기" })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: "ZIP 다운로드" })).not.toBeDisabled();
    });
  });

  it("미리보기 Object URL을 파일 교체, 초기화, 언마운트에서 회수한다", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn((_: Blob) => `blob:preview-${createObjectURL.mock.calls.length}`);
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    mockRenderPdfToPngs.mockResolvedValue(makePngPages());

    const { unmount } = render(<App />);
    const input = screen.getByLabelText("PDF 파일 선택");

    await user.upload(input, createPdf());
    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));
    await screen.findByAltText("수업자료-00.png 미리보기");

    await user.upload(input, createPdf());
    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    });

    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));
    await screen.findByAltText("수업자료-00.png 미리보기");
    await user.click(screen.getByRole("button", { name: "초기화" }));
    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledTimes(4);
    });

    await user.upload(input, createPdf());
    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));
    await screen.findByAltText("수업자료-00.png 미리보기");
    unmount();

    expect(createObjectURL).toHaveBeenCalledTimes(6);
    expect(revokeObjectURL).toHaveBeenCalledTimes(6);
  });

  it("PDF가 아닌 파일을 업로드하면 상태 메시지를 표시한다", async () => {
    const user = userEvent.setup({ applyAccept: false });
    mockValidatePdfFile.mockRejectedValue(
      new PdfValidationError("PDF 파일만 선택할 수 있습니다."),
    );

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

  it("변환 오류를 고정된 한국어 안내로 표시한다", async () => {
    const user = userEvent.setup();
    mockRenderPdfToPngs.mockRejectedValue({
      name: "PasswordException",
      message: "No password given",
    });

    render(<App />);

    await user.upload(screen.getByLabelText("PDF 파일 선택"), createPdf());
    await user.click(screen.getByRole("button", { name: "PNG로 변환하기" }));

    await waitFor(() => {
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent(
        "암호로 보호된 PDF는 변환할 수 없습니다. 암호를 해제한 뒤 다시 시도해 주세요.",
      );
      expect(status).not.toHaveTextContent("No password given");
    });
  });

  it("늦게 끝난 이전 파일 검증 결과를 무시한다", async () => {
    const first = createDeferredPdf();
    const second = createDeferredPdf("새자료.pdf");

    render(<App />);

    const input = screen.getByLabelText("PDF 파일 선택");
    fireEvent.change(input, { target: { files: [first.file] } });
    expect(input).toBeDisabled();
    fireEvent.change(input, {
      target: { files: [second.file] },
    });

    first.resolveHeader("%PDF-1.7");
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("PDF 파일을 선택해 주세요.");
      expect(input).toBeDisabled();
    });
    second.resolveHeader("%PDF-1.7");

    await waitFor(() => {
      expect(screen.getByText("새자료.pdf")).toBeVisible();
      expect(input).not.toBeDisabled();
    });
  });

  it("초기화 후 늦은 PDF 검증 성공을 무시한다", async () => {
    const user = userEvent.setup();
    const deferred = createDeferredPdf();

    render(<App />);

    const input = screen.getByLabelText("PDF 파일 선택");
    fireEvent.change(input, { target: { files: [deferred.file] } });
    expect(input).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "초기화" }));
    expect(input).not.toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("PDF 파일을 선택해 주세요.");

    deferred.resolveHeader("%PDF-1.7");

    await waitFor(() => {
      expect(screen.queryByText("수업자료.pdf")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "PNG로 변환하기" })).toBeDisabled();
      expect(screen.getByRole("status")).toHaveTextContent("PDF 파일을 선택해 주세요.");
    });
  });

  it("초기화 후 늦은 PDF 검증 실패를 무시한다", async () => {
    const user = userEvent.setup();
    const deferred = createDeferredPdf();

    render(<App />);

    fireEvent.change(screen.getByLabelText("PDF 파일 선택"), {
      target: { files: [deferred.file] },
    });
    await user.click(screen.getByRole("button", { name: "초기화" }));

    deferred.rejectHeader(new Error("raw signature read failure"));

    await waitFor(() => {
      expect(screen.queryByText("수업자료.pdf")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("PDF 파일을 선택해 주세요.");
    });
  });
});
