# Task 2 Report: Cancellable ZIP Worker and Download State

## Scope

Implemented only the Task 2 files and interfaces from `task-2-brief.md`.

- Added a typed Vite ZIP worker protocol and a production worker that owns JSZip.
- Added `createZipArchive`, using `STORE` for already-compressed PNG data.
- Moved multi-PNG ZIP creation behind `buildDownloadBlob(..., options)` with injected-worker test support, progress propagation, abort handling, listener cleanup, and worker termination.
- Preserved the one-PNG path as the original Blob without constructing a worker.
- Added guarded download state, operation IDs, abort-on-reset/file-replacement behavior, and disabled ZIP progress UI.

## TDD Evidence

### RED

Before production implementation, added archive, worker wrapper, abort, and app interaction tests, then ran:

```text
npm test -- --run src/lib/zipArchive.test.ts src/lib/downloads.test.ts src/App.test.tsx
exit 1
```

Expected failures were observed: `./zipArchive` could not resolve; no worker `postMessage` or progress callback occurred; an already-aborted signal resolved instead of rejecting with `AbortError`; no injected worker was terminated; `App` passed only two download arguments; and two rapid clicks started two downloads.

### GREEN

Implemented the worker/protocol/archive/download/UI code, then reran the covering command:

```text
Test Files  3 passed (3)
Tests       15 passed (15)
```

The ZIP archive assertion was refined to inspect the public `generateAsync` options because JSZip intentionally does not preserve per-entry compression metadata when reading an archive back.

## Verification

| Command | Result |
| --- | --- |
| `npm test -- --run src/lib/zipArchive.test.ts src/lib/downloads.test.ts src/App.test.tsx` | 3 files, 15 tests passed |
| `npm test` | 6 files, 32 tests passed |
| `npm run lint` | passed (`tsc -b --noEmit`) |
| `npm run build` | passed; emitted `dist/assets/zip.worker-BEO5GhDs.js` |
| `git diff --check` | passed |

The production build retains Vite's pre-existing informational main-chunk size warning; it is unrelated to this task.

## Self-review

- `buildDownloadBlob` checks an already-aborted signal before worker creation, terminates the worker exactly once after completion, error, or abort, and removes its listeners before settling.
- The worker protocol is a discriminated union, and the real default uses `new Worker(new URL(...), { type: "module" })`; tests use an injected `FakeWorker` factory.
- The app's controller ref blocks synchronous repeated clicks before React can repaint, while operation IDs prevent stale cancellation/completion from updating the replacement file's UI.
- No unrelated tracked changes were present before this Task 2 work.

## Fix Review

Addressed every Important review finding:

- Worker, wrapper, and app download failures now use the fixed user-safe message `ZIP 파일 생성에 실패했습니다.`; raw worker protocol messages and caught JavaScript errors are not rendered.
- `postMessage()` is wrapped in the existing `settle`/`cleanup` path, so synchronous throws remove listeners, terminate the worker once, and reject with the fixed message. Worker-construction throws are also normalized before any worker exists.
- ZIP packaging now exposes a native `<progress>` element with a Korean accessible label, `max=100`, current `value`, implicit native minimum `0`, and a Korean live status message.
- Reduced-motion mode disables `.spin` animation and nonessential CSS transitions.

### Fix TDD Evidence

Added regression tests before implementation and ran:

```text
npm test -- --run src/lib/downloads.test.ts src/App.test.tsx
exit 1
```

Expected RED failures showed raw `DataCloneError` and worker error messages escaping, the missing `progressbar`, and the raw JSZip error reaching the app status.

### Fix Verification

| Command | Result |
| --- | --- |
| `npm test -- --run src/lib/downloads.test.ts src/App.test.tsx` | 2 files, 16 tests passed |
| `npm run lint` | passed (`tsc -b --noEmit`) |
| `npm run build` | passed; emitted `dist/assets/zip.worker-D-XGgJ6J.js` |
| `git diff --check` | passed |

`npm run build` retains the existing informational Vite main-chunk size warning.

### Files Changed

- `.superpowers/sdd/task-2-report.md`
- `src/App.css`
- `src/App.test.tsx`
- `src/App.tsx`
- `src/components/ResultList.tsx`
- `src/lib/downloads.test.ts`
- `src/lib/downloads.ts`
- `src/workers/zip.worker.ts`
