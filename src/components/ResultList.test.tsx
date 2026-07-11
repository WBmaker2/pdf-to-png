import { render, screen } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ResultList } from "./ResultList";

const page = {
  pageIndex: 0,
  fileName: "수업자료-00.png",
  blob: new Blob(["page-1"], { type: "image/png" }),
  width: 810,
  height: 1080,
};

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:result-list-preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
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

describe("ResultList", () => {
  it("does not announce the empty result state", () => {
    render(
      <ResultList
        pages={[]}
        isDownloading={false}
        isValidating={false}
        downloadProgress={0}
        onDownload={vi.fn()}
      />,
    );

    expect(screen.queryAllByRole("status")).toHaveLength(0);
  });

  it("announces completion without wrapping the download button or result list", () => {
    render(
      <ResultList
        pages={[page]}
        isDownloading={false}
        isValidating={false}
        downloadProgress={0}
        onDownload={vi.fn()}
      />,
    );

    const status = screen.getByRole("status");

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("변환 완료");
    expect(status).toHaveTextContent("1개의 PNG 파일이 준비되었습니다.");
    expect(status).not.toContainElement(screen.getByRole("button", { name: "PNG 다운로드" }));
    expect(status).not.toContainElement(screen.getByRole("list"));
  });
});
