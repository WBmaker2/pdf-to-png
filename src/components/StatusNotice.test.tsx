import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("StatusNotice", () => {
  it.each([
    ["info", "lucide-info"],
    ["success", "lucide-circle-check"],
    ["error", "lucide-circle-alert"],
  ] as const)("renders the %s tone with its Lucide icon", async (tone, iconClass) => {
    const { StatusNotice } = await import("./StatusNotice");

    render(<StatusNotice tone={tone} message="작업 상태" />);

    expect(screen.getByRole("status")).toHaveClass(`status-message--${tone}`);
    expect(screen.getByTestId("status-icon")).toHaveClass(iconClass);
    expect(screen.getByText("작업 상태")).toBeVisible();
  });
});
