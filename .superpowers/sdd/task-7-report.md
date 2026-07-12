# Task 7 Report: PDF.js Upgrade and Node Floor

## Delivered

- Moved `PageSize` and `getScaleForLongEdge` unchanged to `src/lib/pageScale.ts`.
- Changed `src/lib/pdfRender.test.ts` to import the pure helper without evaluating PDF.js in jsdom.
- Pinned `pdfjs-dist` to exactly `6.1.200` in `package.json` and `package-lock.json`.
- Added `engines.node` `>=22.13.0` and set Pages CI `node-version` to exactly `22.14.0`.
- Adapted only PDF.js 6 API differences: passed `canvas` to `page.render`, used `pdf.cleanup()`, and retained `loadingTask.destroy()` for worker/resource shutdown.
- Preserved `App.tsx` dynamic import chunking, PDF.js worker URL setup, abort handling, file/page/rendered-byte limits, page cleanup, and canvas release.
- Strengthened the real three-page Chromium E2E to assert output names, displayed dimensions, and PNG natural dimensions.
- React and toolchain versions remain unchanged.

## TDD Evidence

### RED

Changed the test import to `./pageScale` before creating the module.

```text
$ npm test -- --run src/lib/pdfRender.test.ts
exit code: 1
Error: Failed to resolve import "./pageScale" from "src/lib/pdfRender.test.ts".
Test Files  1 failed (1)
Tests  no tests
```

### GREEN

Created `src/lib/pageScale.ts` with the original validation and scaling behavior, then imported it from `pdfRender.ts`.

```text
$ npm test -- --run src/lib/pdfRender.test.ts
Test Files  1 passed (1)
Tests  7 passed (7)
exit code: 0
```

The focused output contains no PDF.js Node-environment warning.

## Exact Verification Evidence

```text
$ npm test -- --run
Test Files  12 passed (12)
Tests  72 passed (72)
exit code: 0

$ env -u NO_COLOR npm run test:e2e -- --project=chromium
Running 2 tests using 1 worker
2 passed (2.9s)
exit code: 0
```

The first E2E test verified three real rendered outputs named `sample-00.png`, `sample-01.png`, and `sample-02.png`. Each displayed dimension and PNG natural dimension was `835 x 1080`, so the long edge was `1080` for all three pages. It also verified the ZIP filename `sample-png-1080px.zip` and empty browser console/page error arrays.

```text
$ npm run lint
> tsc -b --noEmit
exit code: 0

$ npm run build
vite v8.1.4 building client environment for production...
1579 modules transformed.
exit code: 0

$ npm audit --omit=dev
found 0 vulnerabilities
exit code: 0

$ git diff --check
exit code: 0
```

## Build Chunk Evidence

```text
dist/assets/index-DLFDN8Io.js          155.96 kB   gzip 51.43 kB   initial entry
dist/assets/downloads-fMh2xA_r.js        1.44 kB   gzip 0.84 kB    lazy download module
dist/assets/fileNames-DpuVyltZ.js        0.34 kB   gzip 0.26 kB    lazy shared dependency
dist/assets/pdfRender-1gi0ai3x.js      426.16 kB   gzip 127.35 kB  lazy PDF render module
dist/assets/pdf.worker-CPbhI6B3.mjs  2,206.29 kB                  PDF.js worker
dist/assets/zip.worker-pEH_Gxa_.js     97.99 kB                   JSZip worker
dist/assets/index-w0TnNi94.css           5.48 kB   gzip 1.75 kB    stylesheet
```

The build emitted no Vite warning. PDF.js remains outside the initial entry chunk and the worker remains separate.

## Warnings

- A normal E2E invocation under the desktop shell printed Node warnings that `NO_COLOR` was ignored because `FORCE_COLOR` was set. The final `env -u NO_COLOR` invocation was warning-free and passed.
- Two earlier sandbox-only Chromium retries failed before test execution with a macOS Mach-port permission error. The permission-expanded final run passed; this was an environment execution issue, not an application or test failure.

## Self-review

- Confirmed `App.tsx` still dynamically imports `./lib/pdfRender` only when conversion starts.
- Confirmed the PDF.js worker URL assignment remains in `pdfRender.ts`.
- Confirmed abort listeners, loading-task destruction, page cleanup, canvas zeroing, file/page/PNG byte limits, and final document cleanup remain present.
- Confirmed `package.json` and lock both resolve `pdfjs-dist` to exact `6.1.200`, while React and toolchain version declarations are unchanged.
- Confirmed only Task 7 implementation/test/config files are tracked; this report lives in the existing ignored `.superpowers/sdd` evidence directory.

## Concerns

None in the required verification set.

## Task 7 Lifecycle Patch Evidence

The lifecycle patch makes loading-task destruction idempotent, keeps the abort-listener rejection handled, performs the post-load abort check inside the document cleanup boundary, and always attempts page and document cleanup while preserving a primary abort or render error.

```text
$ npm test -- --run src/lib/pdfRender.test.ts
Test Files  1 passed (1)
Tests  12 passed (12)
exit code: 0
```

```text
$ npm test -- --run
Test Files  12 passed (12)
Tests  77 passed (77)
exit code: 0

$ npm run lint
> tsc -b --noEmit
exit code: 0

$ npm audit --omit=dev
found 0 vulnerabilities
exit code: 0

$ git diff --check
exit code: 0
```

```text
$ npm run build
vite v8.1.4 building client environment for production...
1579 modules transformed.
✓ built in 439ms
exit code: 0
```

```text
$ env -u NO_COLOR npm run test:e2e -- --project=chromium
Running 2 tests using 1 worker
2 passed (2.6s)
exit code: 0
```

The first non-escalated Chromium launch stopped before test execution with macOS `MachPortRendezvousServer` permission denied. The same command completed successfully with the required permission-expanded execution above.
