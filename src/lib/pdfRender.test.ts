import { describe, expect, it } from "vitest";
import { getScaleForLongEdge } from "./pdfRender";

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
});
