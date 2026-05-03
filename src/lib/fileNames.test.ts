import { describe, expect, it } from "vitest";
import {
  buildPngFileName,
  buildZipFileName,
  pageIndexWidth,
  safeBaseName,
} from "./fileNames";

describe("file name utilities", () => {
  it("removes .pdf extension in safeBaseName", () => {
    expect(safeBaseName("수업자료.pdf")).toBe("수업자료");
    expect(safeBaseName("Lesson.PDF")).toBe("Lesson");
  });

  it("removes path separators before sanitizing", () => {
    expect(safeBaseName("/tmp/uploads/수업자료.pdf")).toBe("수업자료");
    expect(safeBaseName("C:\\Users\\teacher\\Lesson.PDF")).toBe("Lesson");
  });

  it("replaces invalid filename characters and control characters", () => {
    expect(safeBaseName('bad<>:"|?*.pdf')).toBe("bad-------");
    expect(safeBaseName("bad\u0000name.pdf")).toBe("bad-name");
  });

  it("normalizes whitespace", () => {
    expect(safeBaseName("  Unit   1   Review.pdf  ")).toBe("Unit 1 Review");
  });

  it("falls back to document when the base name is empty", () => {
    expect(safeBaseName("   .pdf   ")).toBe("document");
    expect(safeBaseName("///")).toBe("document");
  });

  it("calculates page index width", () => {
    expect(pageIndexWidth(1)).toBe(2);
    expect(pageIndexWidth(12)).toBe(2);
    expect(pageIndexWidth(120)).toBe(3);
  });

  it("builds png file name with zero-padded page index", () => {
    expect(buildPngFileName("수업자료.pdf", 0, 4)).toBe("수업자료-00.png");
    expect(buildPngFileName("수업자료.pdf", 3, 4)).toBe("수업자료-03.png");
    expect(buildPngFileName("자료.pdf", 104, 120)).toBe("자료-104.png");
  });

  it("builds zip file name", () => {
    expect(buildZipFileName("수업자료.pdf")).toBe("수업자료-png-1080p.zip");
  });
});
