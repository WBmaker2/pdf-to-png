import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileDropzone } from "./FileDropzone";

const createDeferredPdf = () => {
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
  const file = new File(["deferred"], "수업자료.pdf", {
    type: "application/pdf",
  });

  Object.defineProperty(file, "slice", {
    value: () => ({ text: () => header }) as Blob,
  });

  return { file, rejectHeader, resolveHeader };
};

const renderDropzone = () => {
  const onSelectFile = vi.fn();
  const onRejectFile = vi.fn();
  const view = render(
    <FileDropzone
      selectedFile={null}
      validationResetId={0}
      onSelectFile={onSelectFile}
      onRejectFile={onRejectFile}
    />,
  );

  return { ...view, onRejectFile, onSelectFile };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FileDropzone", () => {
  it("does not select a file after an unmounted validation succeeds", async () => {
    const deferred = createDeferredPdf();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { onRejectFile, onSelectFile, unmount } = renderDropzone();

    fireEvent.change(screen.getByLabelText("PDF 파일 선택"), {
      target: { files: [deferred.file] },
    });
    unmount();

    await act(async () => {
      deferred.resolveHeader("%PDF-1.7");
      await Promise.resolve();
    });

    expect(onSelectFile).not.toHaveBeenCalled();
    expect(onRejectFile).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("does not reject a file after an unmounted validation fails", async () => {
    const deferred = createDeferredPdf();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { onRejectFile, onSelectFile, unmount } = renderDropzone();

    fireEvent.change(screen.getByLabelText("PDF 파일 선택"), {
      target: { files: [deferred.file] },
    });
    unmount();

    await act(async () => {
      deferred.rejectHeader(new Error("signature read failed"));
      await Promise.resolve();
    });

    expect(onSelectFile).not.toHaveBeenCalled();
    expect(onRejectFile).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
