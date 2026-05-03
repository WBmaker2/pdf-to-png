import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders the converter heading", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "PDF를 1080p PNG로 변환",
      }),
    ).toBeInTheDocument();
  });
});
