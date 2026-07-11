import { describe, expect, it } from "vitest";
import { getScaleForLongEdge } from "./pageScale";

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

  it("throws when targetLongEdge is NaN", () => {
    expect(() =>
      getScaleForLongEdge({ width: 612, height: 792 }, Number.NaN),
    ).toThrow(/targetLongEdge/);
  });

  it("throws when targetLongEdge is Infinity", () => {
    expect(() =>
      getScaleForLongEdge({ width: 612, height: 792 }, Number.POSITIVE_INFINITY),
    ).toThrow(/targetLongEdge/);
  });

  it("throws when page width is invalid", () => {
    expect(() =>
      getScaleForLongEdge(
        { width: Number.NaN, height: 792 },
        1080,
      ),
    ).toThrow(/pageSize/);
  });

  it("throws when page height is non-positive", () => {
    expect(() =>
      getScaleForLongEdge({ width: 612, height: 0 }, 1080),
    ).toThrow(/pageSize/);
  });
});
