import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import UpdateHistoryDialog from "./UpdateHistoryDialog";

const openDialog = async () => {
  const user = userEvent.setup();
  render(<UpdateHistoryDialog />);
  const trigger = screen.getByRole("button", { name: "업데이트 내역" });
  await user.click(trigger);

  return { trigger, user, dialog: screen.getByRole("dialog", { name: "업데이트 내역" }) };
};

afterEach(() => {
  document.body.style.overflow = "";
});

describe("UpdateHistoryDialog", () => {
  it("opens an accessible dialog with exact newest-first update history", async () => {
    const { dialog } = await openDialog();

    expect(dialog).toBeVisible();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "update-history-title");
    expect(screen.getByText("2026-07-12")).toBeVisible();
    expect(screen.getByText("안정성 및 사용성 개선")).toBeVisible();
    expect(screen.getByText("2026-05-03")).toBeVisible();
    expect(screen.getByText("최초 개발")).toBeVisible();
    expect(dialog.textContent?.indexOf("2026-07-12")).toBeLessThan(
      dialog.textContent?.indexOf("2026-05-03") ?? -1,
    );
    expect(dialog).toHaveTextContent("대용량 PDF 보호와 취소 가능한 ZIP 생성을 추가했습니다.");
    expect(dialog).toHaveTextContent("앱 종료와 PDF 페이지 처리 중 취소 안정성을 강화했습니다.");
    expect(dialog).toHaveTextContent("PDF 각 페이지를 긴 변 1080px PNG로 변환하는 기능을 만들었습니다.");
  });

  it("closes with Escape and restores focus to the trigger", async () => {
    const { trigger, user } = await openDialog();

    expect(screen.getByRole("button", { name: "업데이트 내역 닫기" })).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes with the icon-only close button", async () => {
    const { trigger, user } = await openDialog();

    await user.click(screen.getByRole("button", { name: "업데이트 내역 닫기" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes only when the actual backdrop is clicked", async () => {
    const { dialog } = await openDialog();
    const backdrop = dialog.parentElement;

    expect(backdrop).not.toBeNull();
    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(backdrop as HTMLElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("wraps Tab and Shift+Tab within the dialog focusables", async () => {
    const { user } = await openDialog();
    const closeButton = screen.getByRole("button", { name: "업데이트 내역 닫기" });

    await user.tab();
    expect(closeButton).toHaveFocus();
    await user.tab({ shift: true });
    expect(closeButton).toHaveFocus();
  });

  it("locks body scrolling and restores it after close and unmount", async () => {
    document.body.style.overflow = "scroll";
    const user = userEvent.setup();
    const { unmount } = render(<UpdateHistoryDialog />);
    await user.click(screen.getByRole("button", { name: "업데이트 내역" }));

    expect(document.body.style.overflow).toBe("hidden");
    await user.click(screen.getByRole("button", { name: "업데이트 내역 닫기" }));
    expect(document.body.style.overflow).toBe("scroll");

    await user.click(screen.getByRole("button", { name: "업데이트 내역" }));
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("scroll");
  });
});
