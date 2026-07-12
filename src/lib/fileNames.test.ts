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

  it("keeps two digits through 100 pages and expands at 101 pages", () => {
    expect(pageIndexWidth(1)).toBe(2);
    expect(pageIndexWidth(10)).toBe(2);
    expect(pageIndexWidth(100)).toBe(2);
    expect(pageIndexWidth(101)).toBe(3);
    expect(pageIndexWidth(120)).toBe(3);
  });

  it("builds exact zero-based filenames at page-count boundaries", () => {
    expect(buildPngFileName("자료.pdf", 0, 1)).toBe("자료-00.png");
    expect(buildPngFileName("자료.pdf", 0, 10)).toBe("자료-00.png");
    expect(buildPngFileName("자료.pdf", 9, 10)).toBe("자료-09.png");
    expect(buildPngFileName("자료.pdf", 0, 100)).toBe("자료-00.png");
    expect(buildPngFileName("자료.pdf", 99, 100)).toBe("자료-99.png");
    expect(buildPngFileName("자료.pdf", 0, 101)).toBe("자료-000.png");
    expect(buildPngFileName("자료.pdf", 100, 101)).toBe("자료-100.png");
  });

  it("builds zip file name", () => {
    expect(buildZipFileName("수업자료.pdf")).toBe("수업자료-png-1080px.zip");
  });
});
