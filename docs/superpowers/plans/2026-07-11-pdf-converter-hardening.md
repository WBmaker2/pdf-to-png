# PDF Converter Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the client-only PDF-to-PNG converter resilient for real documents, responsive during ZIP creation, understandable when files fail, automatically tested in a browser, visually polished, and current on supported dependencies.

**Architecture:** Keep conversion entirely in the browser and retain the existing React/Vite/PDF.js shape. Put hard resource ceilings around the necessarily memory-heavy render pipeline, move ZIP work off the UI thread into a cancellable Web Worker, centralize PDF validation/error mapping, and lazy-load conversion modules. Treat the interface as one compact utility surface with progressive upload, conversion, and result states.

**Tech Stack:** React, TypeScript, Vite, PDF.js, JSZip in a Web Worker, Vitest/Testing Library, Playwright, GitHub Pages.

## Global Constraints

- All PDF and PNG bytes stay in the browser; no server upload, analytics payload, or remote persistence is allowed.
- Render every PDF page at its original aspect ratio with the long edge exactly `1080` pixels.
- PNG names use the sanitized original PDF base name plus a zero-based page index with at least two digits: `원본이름-00.png`, `원본이름-01.png`.
- A one-page PDF downloads as its PNG; two or more pages download as one ZIP containing the named PNG files.
- Reject files larger than `50 * 1024 * 1024` bytes, PDFs over `50` pages, and accumulated rendered PNG bytes over `200 * 1024 * 1024` bytes.
- All user-facing copy is Korean and must not expose raw PDF.js, worker, or JavaScript error text.
- The app remains usable at viewport widths from `320px` upward with no horizontal overflow or overlapping controls.
- Interactive progress must use semantic status/progress attributes and motion must respect `prefers-reduced-motion`.
- Use the Open Design `Neutral Modern` direction: quiet utility layout, flat white surfaces, restrained cobalt accent, green/red only for status, `8px` maximum card/control radius, no gradients, decorative blobs, or nested cards.
- Preserve unrelated existing work and follow TDD: add a failing test, observe the failure, implement, then rerun covering tests before each commit.

---

### Task 1: Conversion Resource Limits

**Files:**
- Create: `src/lib/conversionLimits.ts`
- Create: `src/lib/conversionLimits.test.ts`
- Modify: `src/lib/pdfRender.ts`

**Interfaces:**
- Produces: `MAX_PDF_FILE_BYTES`, `MAX_PDF_PAGE_COUNT`, `MAX_RENDERED_PNG_BYTES`.
- Produces: `ConversionLimitError`, `assertPdfFileSize(file)`, `assertPdfPageCount(count)`, and `assertRenderedPngBytes(bytes)`.
- `renderPdfToPngs` applies all three guards and keeps its existing public signature.

- [ ] **Step 1: Write the failing limit tests**

```ts
import { describe, expect, it } from "vitest";
import {
  MAX_PDF_FILE_BYTES,
  MAX_PDF_PAGE_COUNT,
  MAX_RENDERED_PNG_BYTES,
  assertPdfFileSize,
  assertPdfPageCount,
  assertRenderedPngBytes,
} from "./conversionLimits";

describe("conversion limits", () => {
  it("accepts exact limits", () => {
    expect(() => assertPdfFileSize({ size: MAX_PDF_FILE_BYTES })).not.toThrow();
    expect(() => assertPdfPageCount(MAX_PDF_PAGE_COUNT)).not.toThrow();
    expect(() => assertRenderedPngBytes(MAX_RENDERED_PNG_BYTES)).not.toThrow();
  });

  it("rejects values over each limit with Korean guidance", () => {
    expect(() => assertPdfFileSize({ size: MAX_PDF_FILE_BYTES + 1 })).toThrow("50MB");
    expect(() => assertPdfPageCount(MAX_PDF_PAGE_COUNT + 1)).toThrow("50페이지");
    expect(() => assertRenderedPngBytes(MAX_RENDERED_PNG_BYTES + 1)).toThrow("200MB");
  });
});
```

- [ ] **Step 2: Run the tests and observe the missing-module failure**

Run: `npm test -- --run src/lib/conversionLimits.test.ts`

Expected: FAIL because `./conversionLimits` does not exist.

- [ ] **Step 3: Implement exact resource guards**

```ts
export const MAX_PDF_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_PDF_PAGE_COUNT = 50;
export const MAX_RENDERED_PNG_BYTES = 200 * 1024 * 1024;

export class ConversionLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversionLimitError";
  }
}

export function assertPdfFileSize(file: Pick<File, "size">): void {
  if (file.size > MAX_PDF_FILE_BYTES) {
    throw new ConversionLimitError("PDF 파일은 50MB 이하만 변환할 수 있습니다.");
  }
}

export function assertPdfPageCount(pageCount: number): void {
  if (pageCount > MAX_PDF_PAGE_COUNT) {
    throw new ConversionLimitError("PDF는 최대 50페이지까지 변환할 수 있습니다.");
  }
}

export function assertRenderedPngBytes(totalBytes: number): void {
  if (totalBytes > MAX_RENDERED_PNG_BYTES) {
    throw new ConversionLimitError("변환 결과가 200MB를 넘어 작업을 중단했습니다.");
  }
}
```

Call `assertPdfFileSize(file)` before `file.arrayBuffer()`, call `assertPdfPageCount(pdf.numPages)` immediately after document load, and keep a cumulative `renderedBytes` counter. Check `renderedBytes + blob.size` before adding each page to the returned array. Existing `finally` cleanup for pages, canvases, loading tasks, and the PDF document must remain intact.

- [ ] **Step 4: Run covering and baseline tests**

Run: `npm test -- --run src/lib/conversionLimits.test.ts src/lib/pdfRender.test.ts`

Expected: both files PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/conversionLimits.ts src/lib/conversionLimits.test.ts src/lib/pdfRender.ts
git commit -m "feat: guard PDF conversion resource usage"
```

---

### Task 2: Cancellable ZIP Worker and Download State

**Files:**
- Create: `src/types/zipWorker.ts`
- Create: `src/lib/zipArchive.ts`
- Create: `src/lib/zipArchive.test.ts`
- Create: `src/workers/zip.worker.ts`
- Modify: `src/lib/downloads.ts`
- Modify: `src/lib/downloads.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/ResultList.tsx`

**Interfaces:**
- `BuildDownloadOptions = { signal?: AbortSignal; onProgress?: (percent: number) => void; workerFactory?: () => Worker }`.
- `buildDownloadBlob(originalFileName, pages, options?)` remains the download entry point.
- Worker messages are discriminated unions: input `{ type: "build"; pages }`; output `{ type: "progress"; percent }`, `{ type: "complete"; blob }`, or `{ type: "error"; message }`.
- `ResultList` additionally consumes `isDownloading` and `downloadProgress`.

- [ ] **Step 1: Add failing archive and interaction tests**

Tests must prove:

```ts
expect(onProgress).toHaveBeenCalledWith(expect.any(Number));
expect(result.blob.type).toBe("application/zip");
expect(fakeWorker.terminate).toHaveBeenCalledTimes(1);
expect(buildDownloadBlob).toHaveBeenCalledTimes(1); // rapid repeated click
expect(screen.getByRole("button", { name: /ZIP 생성 중/ })).toBeDisabled();
```

Also assert that an already-aborted signal rejects with an error whose `name` is `AbortError`, and that a mid-flight abort terminates the injected worker.

- [ ] **Step 2: Run tests and observe failures**

Run: `npm test -- --run src/lib/zipArchive.test.ts src/lib/downloads.test.ts src/App.test.tsx`

Expected: FAIL because worker/progress APIs do not exist.

- [ ] **Step 3: Implement ZIP creation with no redundant PNG compression**

`createZipArchive` must add each PNG and call:

```ts
return zip.generateAsync(
  { type: "blob", compression: "STORE", mimeType: "application/zip" },
  ({ percent }) => onProgress?.(Math.round(percent)),
);
```

The Web Worker owns `createZipArchive`; the main-thread wrapper constructs it with `new Worker(new URL("../workers/zip.worker.ts", import.meta.url), { type: "module" })`. On completion, error, or abort, remove listeners and call `worker.terminate()`. A single PNG bypasses the worker and returns its original Blob.

- [ ] **Step 4: Add guarded app download state**

Add `isDownloading`, integer `downloadProgress`, a download operation id, and an `AbortController`. Ignore a second download while one is active. Reset/file replacement abort both conversion and download. Pass progress to `ResultList`; while packaging, disable the download button and render `ZIP 생성 중 {percent}%` with a spinner.

- [ ] **Step 5: Run covering tests**

Run: `npm test -- --run src/lib/zipArchive.test.ts src/lib/downloads.test.ts src/App.test.tsx`

Expected: all covering tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/zipWorker.ts src/lib/zipArchive.ts src/lib/zipArchive.test.ts src/workers/zip.worker.ts src/lib/downloads.ts src/lib/downloads.test.ts src/App.tsx src/App.test.tsx src/components/ResultList.tsx
git commit -m "feat: package ZIP downloads in a cancellable worker"
```

---

### Task 3: PDF Validation and Friendly Errors

**Files:**
- Create: `src/lib/pdfValidation.ts`
- Create: `src/lib/pdfValidation.test.ts`
- Create: `src/lib/userMessages.ts`
- Create: `src/lib/userMessages.test.ts`
- Modify: `src/components/FileDropzone.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- `validatePdfFile(file: File): Promise<void>` checks extension/MIME, size, and `%PDF-` within the first `1024` bytes.
- `getConversionErrorMessage(error: unknown): string` and `getDownloadErrorMessage(error: unknown): string` return Korean copy only.

- [ ] **Step 1: Write failing validation and mapping tests**

```ts
it("accepts a PDF signature in the first 1024 bytes", async () => {
  await expect(validatePdfFile(new File(["prefix\n%PDF-1.7\n"], "자료.pdf"))).resolves.toBeUndefined();
});

it("rejects a renamed non-PDF", async () => {
  await expect(validatePdfFile(new File(["plain text"], "자료.pdf"))).rejects.toThrow("올바른 PDF");
});

it("maps password errors without exposing internals", () => {
  expect(getConversionErrorMessage({ name: "PasswordException", message: "raw" }))
    .toBe("암호로 보호된 PDF는 변환할 수 없습니다. 암호를 해제한 뒤 다시 시도해 주세요.");
});
```

Cover `InvalidPDFException`, `MissingPDFException`, `UnexpectedResponseException`, `AbortError`, `ConversionLimitError`, and unknown errors. Unknown messages must become fixed Korean fallback copy.

- [ ] **Step 2: Run tests and observe failures**

Run: `npm test -- --run src/lib/pdfValidation.test.ts src/lib/userMessages.test.ts src/App.test.tsx`

Expected: FAIL because validation and mapping modules do not exist.

- [ ] **Step 3: Implement signature validation and error mapping**

Read `file.slice(0, 1024).text()` and require `header.includes("%PDF-")`. Call `assertPdfFileSize(file)` before reading. Preserve `AbortError` as the user copy `작업이 취소되었습니다.` and never return `error.message` for an unrecognized error.

Make `FileDropzone.handleFile` asynchronous, disable selection while validation is running, and only call `onSelectFile` after validation passes. Route failures through `onRejectFile(getConversionErrorMessage(error))`.

- [ ] **Step 4: Route app failures through the mappers**

Replace both raw `error.message` branches in `App.tsx`. Add an app test that rejects rendering with `{ name: "PasswordException", message: "No password given" }` and asserts only the Korean password guidance is visible.

- [ ] **Step 5: Run covering tests**

Run: `npm test -- --run src/lib/pdfValidation.test.ts src/lib/userMessages.test.ts src/App.test.tsx`

Expected: all covering tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pdfValidation.ts src/lib/pdfValidation.test.ts src/lib/userMessages.ts src/lib/userMessages.test.ts src/components/FileDropzone.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: validate PDFs and localize converter errors"
```

---

### Task 4: Real-PDF Playwright Coverage

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/fixtures/createTestPdf.ts`
- Create: `e2e/pdf-converter.spec.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Modify: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- `createTestPdf(pageCount: number): Buffer` returns a standards-valid in-memory PDF with calculated xref offsets.
- `npm run test:e2e` runs Chromium against the Vite development server at `/pdf-to-png/`.

- [ ] **Step 1: Install Playwright and add the initial failing browser test**

Run: `npm --cache /tmp/pdf-to-png-npm-cache install -D @playwright/test@1.61.1`

Add script `"test:e2e": "playwright test"`, ignore `test-results/` and `playwright-report/`, and configure one Chromium project with `baseURL: "http://127.0.0.1:4173/pdf-to-png/"` and web server command `npm run dev -- --host 127.0.0.1 --port 4173`.

The first test uploads a generated three-page `sample.pdf`, starts conversion, and asserts `sample-00.png`, `sample-01.png`, and `sample-02.png` appear.

- [ ] **Step 2: Run the test and observe the fixture/behavior failure**

Run: `npm run test:e2e -- --project=chromium`

Expected: FAIL until the generated PDF and selectors are valid.

- [ ] **Step 3: Implement the deterministic in-memory PDF fixture**

Build catalog, pages, page, content stream, and Helvetica font objects as ASCII strings. Calculate every byte offset with `Buffer.byteLength`, emit a zero-padded xref table, trailer, `startxref`, and `%%EOF`. Create exactly `pageCount` page objects, each with MediaBox `[0 0 612 792]` and visible `Page N` text.

- [ ] **Step 4: Complete browser coverage**

Add tests that verify:

```ts
await expect(page.getByText("sample-00.png")).toBeVisible();
expect(download.suggestedFilename()).toBe("sample-png-1080p.zip");
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
expect(consoleErrors).toEqual([]);
```

Run the responsive assertion at `390x844`. Keep selectors role/label based so the later visual redesign can preserve them.

- [ ] **Step 5: Add CI browser setup and execution**

After `npm ci`, add `npx playwright install --with-deps chromium`; after unit tests, add `npm run test:e2e`. Keep build/deploy ordering unchanged.

- [ ] **Step 6: Run unit and E2E tests**

Run: `npm test -- --run && npm run test:e2e -- --project=chromium`

Expected: unit and browser suites PASS.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts e2e package.json package-lock.json .gitignore .github/workflows/deploy-pages.yml
git commit -m "test: cover PDF conversion in Chromium"
```

---

### Task 5: Open Design Utility UI

**Files:**
- Create: `src/components/StatusNotice.tsx`
- Create: `src/components/StatusNotice.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.css`
- Modify: `src/components/FileDropzone.tsx`
- Modify: `src/components/ConversionPanel.tsx`
- Modify: `src/components/ResultList.tsx`
- Modify: `src/lib/fileNames.ts`
- Modify: `src/lib/fileNames.test.ts`
- Modify: `README.md`
- Modify: `e2e/pdf-converter.spec.ts`

**Interfaces:**
- `StatusNotice` consumes `{ tone: "info" | "success" | "error"; message: string }` and renders the corresponding Lucide icon.
- `FileDropzone` supports click, keyboard file input, and drag/drop through the same validation path.
- `ConversionPanel` receives `isDownloading`, uses a semantic `<progress>`, and changes reset copy to `변환 취소` only while conversion is active.
- `ResultList` creates and revokes preview object URLs per page and keeps stable `3 / 4` thumbnail frames.

- [ ] **Step 1: Add failing UI behavior and accessibility tests**

Tests must assert:

```ts
expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
expect(screen.getByRole("button", { name: "초기화" })).toBeDisabled();
expect(screen.getByText(/50MB 이하 · 최대 50페이지/)).toBeVisible();
expect(screen.getByAltText("수업자료-00.png 미리보기")).toBeVisible();
expect(screen.queryByText("2개의 PNG 파일이 준비되었습니다.", { selector: ".status-message" })).not.toBeInTheDocument();
```

Add a drag/drop test that dispatches a `drop` event containing a valid PDF and expects the selected file metadata to appear.

- [ ] **Step 2: Run tests and observe failures**

Run: `npm test -- --run src/components/StatusNotice.test.tsx src/App.test.tsx src/lib/fileNames.test.ts`

Expected: FAIL because the new UI contracts are absent.

- [ ] **Step 3: Restructure the first viewport as a compact tool**

Use exact top copy:

```text
PDF PNG 변환기
긴 변 1080px · 브라우저 내 처리
```

Render one `.converter-tool` surface divided into unframed upload, conversion, and result bands. The desktop header and tool must fit comfortably in the first viewport; mobile stacks naturally. Remove the uppercase eyebrow and the oversized marketing-style headline.

- [ ] **Step 4: Implement complete upload and progress states**

The upload band must accept drag/drop, indicate active drag with a border/background state, and show file name plus formatted size. Show `50MB 이하 · 최대 50페이지` as a compact limit line. Disable reset when no file/result/task exists; use `변환 취소` while converting and `초기화` otherwise.

Use native `<progress max={totalPages} value={currentPage}>` with accessible numeric attributes. Add `aria-busy` to the active conversion/download region.

- [ ] **Step 5: Implement preview results and remove duplicated status**

Each result item is a real repeated card with a fixed thumbnail frame, lazy `<img>`, filename, and dimensions. Create an object URL in an effect and revoke it in cleanup. Conversion success appears in `ResultList`; the visible `StatusNotice` is reserved for errors and actionable task/download notices.

Change the ZIP suffix to `-png-1080px.zip` and update tests/README. Keep PNG page names unchanged.

- [ ] **Step 6: Apply the visual system and accessibility polish**

Use the Korean system font stack `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", sans-serif`. Use neutral gray surfaces, cobalt primary action, green success, red error, no shadow on ordinary sections, and `8px` radii. Do not scale font size with viewport width. Add a `prefers-reduced-motion: reduce` rule that removes spinner animation and transitions.

- [ ] **Step 7: Run component and browser tests**

Run: `npm test -- --run && npm run test:e2e -- --project=chromium`

Expected: all tests PASS with no mobile overflow.

- [ ] **Step 8: Commit**

```bash
git add src README.md e2e/pdf-converter.spec.ts
git commit -m "feat: refine the PDF conversion workflow UI"
```

---

### Task 6: Lazy Loading and Patched Vite Toolchain

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`

**Interfaces:**
- `App` dynamically imports `./lib/pdfRender` only after conversion starts.
- `App` dynamically imports `./lib/downloads` only after download starts.
- Toolchain versions are Vite `8.1.4`, `@vitejs/plugin-react` `6.0.3`, Vitest `4.1.10`, and jsdom `29.1.1`.

- [ ] **Step 1: Add a failing lazy-load orchestration test**

Keep module mocks but assert `renderPdfToPngs` has not run before conversion and `buildDownloadBlob` has not run before download. Use `waitFor` after clicking because imports resolve asynchronously.

- [ ] **Step 2: Run App tests before implementation**

Run: `npm test -- --run src/App.test.tsx`

Expected: the new timing assertion fails against static imports or the revised test requires async orchestration.

- [ ] **Step 3: Move conversion modules behind user actions**

Remove runtime imports from the module top. Inside the conversion operation use:

```ts
const { renderPdfToPngs } = await import("./lib/pdfRender");
```

Inside the download operation use:

```ts
const { buildDownloadBlob, downloadBlob } = await import("./lib/downloads");
```

Type-only imports may remain static.

- [ ] **Step 4: Update the toolchain in one isolated dependency step**

Run:

```bash
npm --cache /tmp/pdf-to-png-npm-cache install -D @vitejs/plugin-react@6.0.3 vite@8.1.4 vitest@4.1.10 jsdom@29.1.1 typescript@5.9.3
```

Move `@vitejs/plugin-react` out of `dependencies`. Keep React/PDF.js versions unchanged in this task. Resolve only concrete API/config failures caused by this toolchain step.

- [ ] **Step 5: Verify tests, build split, and audit**

Run: `npm test -- --run && npm run lint && npm run build && npm audit --omit=dev`

Expected: all commands PASS; the initial entry chunk is below `250 kB` minified and PDF.js/JSZip live in lazy or worker chunks.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx package.json package-lock.json vite.config.ts
git commit -m "perf: lazy load converter modules and update Vite"
```

---

### Task 7: PDF.js Upgrade and Node Floor

**Files:**
- Create: `src/lib/pageScale.ts`
- Modify: `src/lib/pdfRender.ts`
- Modify: `src/lib/pdfRender.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- `getScaleForLongEdge` moves unchanged to `src/lib/pageScale.ts` so pure unit tests do not load PDF.js in jsdom.
- `pdfjs-dist` is exactly `6.1.200`.
- Supported Node runtime is `>=22.13.0`; CI uses `22.14.0`.

- [ ] **Step 1: Move the pure scale test and observe the import failure**

Change the test import to `./pageScale` before creating the file.

Run: `npm test -- --run src/lib/pdfRender.test.ts`

Expected: FAIL because `pageScale.ts` does not exist.

- [ ] **Step 2: Extract the pure page scaling module**

Move `PageSize` and `getScaleForLongEdge` without behavior changes. Import it from `pdfRender.ts`; the unit test must no longer print PDF.js Node-environment warnings.

- [ ] **Step 3: Upgrade PDF.js and declare runtime support**

Run: `npm --cache /tmp/pdf-to-png-npm-cache install pdfjs-dist@6.1.200`

Add `"engines": { "node": ">=22.13.0" }` and set the Pages workflow to `node-version: 22.14.0`. Preserve the worker URL setup and adapt imports/types only where PDF.js 6 requires it.

- [ ] **Step 4: Verify real rendering**

Run: `npm test -- --run && npm run lint && npm run build && npm run test:e2e -- --project=chromium`

Expected: all checks PASS and the three-page PDF still renders to three `1080`-long-edge PNGs.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pageScale.ts src/lib/pdfRender.ts src/lib/pdfRender.test.ts package.json package-lock.json .github/workflows/deploy-pages.yml
git commit -m "chore: upgrade PDF.js and isolate page scaling"
```

---

### Task 8: React and UI Dependency Upgrade

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: source/tests only if required for verified React 19 compatibility

**Interfaces:**
- Runtime versions: React `19.2.7`, React DOM `19.2.7`, Lucide React `1.24.0`.
- Development versions: `@types/react` `19.2.17`, `@types/react-dom` `19.2.3`, Testing Library React `16.3.2`, user-event `14.6.1`, jest-dom `6.9.1`.

- [ ] **Step 1: Capture the green pre-upgrade suite**

Run: `npm test -- --run && npm run lint && npm run build`

Expected: all checks PASS before changing React dependencies.

- [ ] **Step 2: Upgrade React and UI test dependencies as one isolated step**

Run:

```bash
npm --cache /tmp/pdf-to-png-npm-cache install react@19.2.7 react-dom@19.2.7 lucide-react@1.24.0
npm --cache /tmp/pdf-to-png-npm-cache install -D @types/react@19.2.17 @types/react-dom@19.2.3 @testing-library/react@16.3.2 @testing-library/user-event@14.6.1 @testing-library/jest-dom@6.9.1
```

Do not change app behavior to accommodate warnings; fix only concrete React 19 type/runtime/test incompatibilities.

- [ ] **Step 3: Run the complete release gate**

Run: `npm test -- --run && npm run lint && npm run build && npm run test:e2e -- --project=chromium && npm audit`

Expected: all functional checks PASS and audit reports no known vulnerabilities.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src
git commit -m "chore: upgrade React and UI dependencies"
```
