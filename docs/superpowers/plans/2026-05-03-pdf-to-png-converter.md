# PDF to PNG 1080p Converter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 브라우저에서 PDF 파일을 선택하면 각 페이지를 고품질 1080p PNG로 변환하고, 결과가 여러 장이면 ZIP으로 묶어 내려받게 만드는 웹앱을 구축합니다.

**Architecture:** 모든 변환은 브라우저 안에서 처리해 PDF 원본을 서버로 업로드하지 않습니다. `pdfjs-dist`로 PDF 페이지를 캔버스에 렌더링하고, 긴 변 기준 1080px을 유지한 PNG Blob을 만든 뒤, 1장이면 PNG를 직접 다운로드하고 2장 이상이면 `jszip`으로 압축합니다.

**Tech Stack:** Vite, React, TypeScript, pdfjs-dist, JSZip, Vitest, Testing Library, CSS Modules-style plain CSS, lucide-react.

---

## Product Decisions

- v1은 PDF 1개를 한 번에 변환합니다.
- 출력 크기는 "1080p"를 긴 변 기준 1080px로 정의합니다. 세로 페이지는 높이가 1080px, 가로 페이지는 너비가 1080px이 됩니다.
- PNG 파일명은 원본 PDF 파일명에서 `.pdf`를 제거한 뒤 `-00`, `-01`, `-02`처럼 0부터 시작하는 페이지 번호를 붙입니다.
- 페이지 수가 100장 이상이면 번호 폭을 자동으로 늘립니다. 예: `자료-000.png`.
- 단일 페이지 PDF는 `원본이름-00.png`를 바로 다운로드합니다.
- 다중 페이지 PDF는 `원본이름-png-1080p.zip`을 다운로드하고, ZIP 내부에 `원본이름-00.png`, `원본이름-01.png` 파일을 넣습니다.
- PDF는 로컬 브라우저 메모리에서만 처리되며 서버 업로드 UI나 네트워크 업로드 로직은 만들지 않습니다.

## Approach Options

**Recommended: Client-only React + pdf.js**
브라우저에서 PDF를 렌더링하고 PNG/ZIP을 생성합니다. 사용자의 PDF가 서버로 전송되지 않아 개인정보 측면에서 가장 단순하고, 정적 호스팅에도 배포할 수 있습니다.

**Alternative: Server-side conversion API**
서버에서 Poppler, ImageMagick, Ghostscript 같은 도구로 변환합니다. 대용량 PDF 처리에는 강하지만 배포 환경과 파일 보관 정책이 복잡해집니다.

**Alternative: WebAssembly conversion engine**
WASM 기반 PDF 렌더러를 직접 묶습니다. 오프라인 처리 장점은 있으나 번들 크기와 브라우저 호환성 관리가 커집니다.

## File Structure

- Create: `package.json` - scripts, dependencies, dev dependencies.
- Create: `index.html` - Vite app shell.
- Create: `vite.config.ts` - React/Vitest configuration.
- Create: `tsconfig.json` - TypeScript project settings.
- Create: `tsconfig.node.json` - Vite config TypeScript settings.
- Create: `src/main.tsx` - React entry.
- Create: `src/App.tsx` - top-level app state and workflow.
- Create: `src/App.test.tsx` - user workflow tests with mocked conversion and downloads.
- Create: `src/App.css` - responsive app styling.
- Create: `src/setupTests.ts` - Testing Library matchers.
- Create: `src/components/FileDropzone.tsx` - file input and drag/drop selection.
- Create: `src/components/ConversionPanel.tsx` - selected file, progress, convert and reset controls.
- Create: `src/components/ResultList.tsx` - generated PNG list and download action.
- Create: `src/lib/fileNames.ts` - deterministic output file naming.
- Create: `src/lib/fileNames.test.ts` - file naming tests.
- Create: `src/lib/pdfRender.ts` - pdf.js worker setup and page rendering.
- Create: `src/lib/pdfRender.test.ts` - 1080p scaling helper tests.
- Create: `src/lib/downloads.ts` - Blob URL download and ZIP packaging.
- Create: `src/lib/downloads.test.ts` - single PNG and ZIP packaging tests.
- Create: `src/types/conversion.ts` - shared conversion types.
- Create: `README.md` - usage, privacy, local development, output naming.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.css`
- Create: `src/setupTests.ts`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Initialize git if the directory has no repository**

Run:

```bash
git status --short
```

Expected if no repository exists:

```text
fatal: not a git repository
```

Then run:

```bash
git init
```

Expected:

```text
Initialized empty Git repository
```

- [ ] **Step 2: Create the package manifest**

Create `package.json`:

```json
{
  "name": "pdf-to-png",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest --environment jsdom",
    "lint": "tsc -b --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "jszip": "^3.10.1",
    "lucide-react": "^0.468.0",
    "pdfjs-dist": "^4.10.38",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.7",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run:

```bash
npm install
```

Expected:

```text
added ... packages
found 0 vulnerabilities
```

- [ ] **Step 4: Add Vite and TypeScript configuration**

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
});
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Add the initial app shell and smoke test**

Create `index.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PDF to PNG 1080p</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Create `src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="app-title">
        <p className="eyebrow">브라우저 안에서 변환</p>
        <h1 id="app-title">PDF를 1080p PNG로 변환</h1>
        <p className="hero-copy">
          PDF 파일을 선택하면 각 페이지를 PNG로 만들고, 여러 장이면 ZIP으로 묶어 다운로드합니다.
        </p>
      </section>
    </main>
  );
}
```

Create `src/App.css`:

```css
:root {
  color: #172026;
  background: #f7f5ef;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background:
    linear-gradient(135deg, rgba(42, 97, 93, 0.14), transparent 36%),
    linear-gradient(315deg, rgba(231, 102, 77, 0.14), transparent 34%),
    #f7f5ef;
}

button,
input {
  font: inherit;
}

.app-shell {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 56px 0;
}

.hero-panel {
  display: grid;
  gap: 16px;
}

.eyebrow {
  margin: 0;
  color: #2a615d;
  font-size: 0.92rem;
  font-weight: 700;
}

h1 {
  margin: 0;
  max-width: 760px;
  font-size: clamp(2.6rem, 8vw, 5.8rem);
  line-height: 0.95;
}

.hero-copy {
  margin: 0;
  max-width: 620px;
  color: #52615f;
  font-size: 1.12rem;
  line-height: 1.65;
}
```

Create `src/setupTests.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Create `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the PDF conversion headline', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'PDF를 1080p PNG로 변환' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Verify the scaffold**

Run:

```bash
npm test -- --run
```

Expected:

```text
1 passed
```

Run:

```bash
npm run build
```

Expected:

```text
✓ built in
```

- [ ] **Step 7: Commit the scaffold**

Run:

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.node.json src
git commit -m "chore: scaffold pdf to png converter"
```

Expected:

```text
[main ...] chore: scaffold pdf to png converter
```

## Task 2: Deterministic File Naming and Packaging

**Files:**
- Create: `src/types/conversion.ts`
- Create: `src/lib/fileNames.ts`
- Create: `src/lib/fileNames.test.ts`
- Create: `src/lib/downloads.ts`
- Create: `src/lib/downloads.test.ts`

- [ ] **Step 1: Add shared output types**

Create `src/types/conversion.ts`:

```ts
export type RenderedPngPage = {
  pageIndex: number;
  fileName: string;
  blob: Blob;
  width: number;
  height: number;
};

export type ConversionProgress = {
  currentPage: number;
  totalPages: number;
};
```

- [ ] **Step 2: Write file naming tests**

Create `src/lib/fileNames.test.ts`:

```ts
import { buildPngFileName, buildZipFileName, pageIndexWidth, safeBaseName } from './fileNames';

describe('fileNames', () => {
  it('removes a pdf extension from the original file name', () => {
    expect(safeBaseName('수업자료.pdf')).toBe('수업자료');
    expect(safeBaseName('Lesson.PDF')).toBe('Lesson');
  });

  it('keeps at least two digits for page numbers', () => {
    expect(pageIndexWidth(1)).toBe(2);
    expect(pageIndexWidth(12)).toBe(2);
    expect(pageIndexWidth(120)).toBe(3);
  });

  it('adds zero-based page numbers to the right of the original name', () => {
    expect(buildPngFileName('수업자료.pdf', 0, 4)).toBe('수업자료-00.png');
    expect(buildPngFileName('수업자료.pdf', 3, 4)).toBe('수업자료-03.png');
    expect(buildPngFileName('자료.pdf', 104, 120)).toBe('자료-104.png');
  });

  it('creates a zip name from the original file name', () => {
    expect(buildZipFileName('수업자료.pdf')).toBe('수업자료-png-1080p.zip');
  });
});
```

- [ ] **Step 3: Run the naming tests and confirm they fail**

Run:

```bash
npm test -- --run src/lib/fileNames.test.ts
```

Expected:

```text
FAIL src/lib/fileNames.test.ts
```

- [ ] **Step 4: Implement file naming**

Create `src/lib/fileNames.ts`:

```ts
export function safeBaseName(fileName: string) {
  const withoutPath = fileName.split(/[\\/]/).pop() ?? 'document';
  const withoutPdf = withoutPath.replace(/\.pdf$/i, '');
  const cleaned = withoutPdf
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ');

  return cleaned.length > 0 ? cleaned : 'document';
}

export function pageIndexWidth(totalPages: number) {
  return Math.max(2, String(Math.max(0, totalPages - 1)).length);
}

export function buildPngFileName(originalFileName: string, pageIndex: number, totalPages: number) {
  const suffix = String(pageIndex).padStart(pageIndexWidth(totalPages), '0');
  return `${safeBaseName(originalFileName)}-${suffix}.png`;
}

export function buildZipFileName(originalFileName: string) {
  return `${safeBaseName(originalFileName)}-png-1080p.zip`;
}
```

- [ ] **Step 5: Write download packaging tests**

Create `src/lib/downloads.test.ts`:

```ts
import JSZip from 'jszip';
import { buildDownloadBlob } from './downloads';
import type { RenderedPngPage } from '../types/conversion';

function pngPage(pageIndex: number, fileName: string): RenderedPngPage {
  return {
    pageIndex,
    fileName,
    blob: new Blob([`page-${pageIndex}`], { type: 'image/png' }),
    width: 764,
    height: 1080,
  };
}

describe('downloads', () => {
  it('returns a single PNG blob when there is only one rendered page', async () => {
    const result = await buildDownloadBlob('자료.pdf', [pngPage(0, '자료-00.png')]);

    expect(result.fileName).toBe('자료-00.png');
    expect(result.blob.type).toBe('image/png');
  });

  it('builds a zip blob when there are multiple rendered pages', async () => {
    const result = await buildDownloadBlob('자료.pdf', [
      pngPage(0, '자료-00.png'),
      pngPage(1, '자료-01.png'),
    ]);

    expect(result.fileName).toBe('자료-png-1080p.zip');
    expect(result.blob.type).toBe('application/zip');

    const zip = await JSZip.loadAsync(result.blob);
    expect(Object.keys(zip.files)).toEqual(['자료-00.png', '자료-01.png']);
  });
});
```

- [ ] **Step 6: Run the download tests and confirm they fail**

Run:

```bash
npm test -- --run src/lib/downloads.test.ts
```

Expected:

```text
FAIL src/lib/downloads.test.ts
```

- [ ] **Step 7: Implement download packaging**

Create `src/lib/downloads.ts`:

```ts
import JSZip from 'jszip';
import { buildZipFileName } from './fileNames';
import type { RenderedPngPage } from '../types/conversion';

export type DownloadBlob = {
  fileName: string;
  blob: Blob;
};

export async function buildDownloadBlob(
  originalFileName: string,
  pages: RenderedPngPage[],
): Promise<DownloadBlob> {
  if (pages.length === 0) {
    throw new Error('다운로드할 PNG가 없습니다.');
  }

  if (pages.length === 1) {
    return {
      fileName: pages[0].fileName,
      blob: pages[0].blob,
    };
  }

  const zip = new JSZip();
  for (const page of pages) {
    zip.file(page.fileName, page.blob);
  }

  return {
    fileName: buildZipFileName(originalFileName),
    blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }),
  };
}

export function downloadBlob({ blob, fileName }: DownloadBlob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 8: Verify naming and packaging**

Run:

```bash
npm test -- --run src/lib/fileNames.test.ts src/lib/downloads.test.ts
```

Expected:

```text
PASS src/lib/fileNames.test.ts
PASS src/lib/downloads.test.ts
```

- [ ] **Step 9: Commit naming and packaging**

Run:

```bash
git add src/types/conversion.ts src/lib/fileNames.ts src/lib/fileNames.test.ts src/lib/downloads.ts src/lib/downloads.test.ts
git commit -m "feat: add png naming and download packaging"
```

## Task 3: PDF Rendering Core

**Files:**
- Create: `src/lib/pdfRender.ts`
- Create: `src/lib/pdfRender.test.ts`

- [ ] **Step 1: Write 1080p scaling tests**

Create `src/lib/pdfRender.test.ts`:

```ts
import { getScaleForLongEdge } from './pdfRender';

describe('getScaleForLongEdge', () => {
  it('scales portrait pages so the height is 1080 pixels', () => {
    expect(getScaleForLongEdge({ width: 612, height: 792 }, 1080)).toBeCloseTo(1.3636, 4);
  });

  it('scales landscape pages so the width is 1080 pixels', () => {
    expect(getScaleForLongEdge({ width: 792, height: 612 }, 1080)).toBeCloseTo(1.3636, 4);
  });

  it('keeps the target edge positive', () => {
    expect(() => getScaleForLongEdge({ width: 612, height: 792 }, 0)).toThrow('targetLongEdge');
  });
});
```

- [ ] **Step 2: Run the PDF render tests and confirm they fail**

Run:

```bash
npm test -- --run src/lib/pdfRender.test.ts
```

Expected:

```text
FAIL src/lib/pdfRender.test.ts
```

- [ ] **Step 3: Implement PDF rendering**

Create `src/lib/pdfRender.ts`:

```ts
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { buildPngFileName } from './fileNames';
import type { ConversionProgress, RenderedPngPage } from '../types/conversion';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export type PageSize = {
  width: number;
  height: number;
};

export type RenderPdfOptions = {
  targetLongEdge: number;
  onProgress?: (progress: ConversionProgress) => void;
};

export function getScaleForLongEdge(pageSize: PageSize, targetLongEdge: number) {
  if (targetLongEdge <= 0) {
    throw new Error('targetLongEdge must be greater than 0');
  }

  return targetLongEdge / Math.max(pageSize.width, pageSize.height);
}

async function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('PNG 생성에 실패했습니다.'));
      }
    }, 'image/png');
  });
}

export async function renderPdfToPngs(
  file: File,
  { targetLongEdge, onProgress }: RenderPdfOptions,
): Promise<RenderedPngPage[]> {
  const data = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pages: RenderedPngPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = getScaleForLongEdge(
      { width: baseViewport.width, height: baseViewport.height },
      targetLongEdge,
    );
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });

    if (!context) {
      throw new Error('캔버스 렌더링 컨텍스트를 만들 수 없습니다.');
    }

    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;

    pages.push({
      pageIndex: pageNumber - 1,
      fileName: buildPngFileName(file.name, pageNumber - 1, pdf.numPages),
      blob: await canvasToPngBlob(canvas),
      width: canvas.width,
      height: canvas.height,
    });

    onProgress?.({ currentPage: pageNumber, totalPages: pdf.numPages });
  }

  return pages;
}
```

- [ ] **Step 4: Verify rendering helpers**

Run:

```bash
npm test -- --run src/lib/pdfRender.test.ts
```

Expected:

```text
PASS src/lib/pdfRender.test.ts
```

- [ ] **Step 5: Commit PDF rendering core**

Run:

```bash
git add src/lib/pdfRender.ts src/lib/pdfRender.test.ts
git commit -m "feat: render pdf pages to 1080p png blobs"
```

## Task 4: Upload, Conversion, and Download UI

**Files:**
- Create: `src/components/FileDropzone.tsx`
- Create: `src/components/ConversionPanel.tsx`
- Create: `src/components/ResultList.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Replace the smoke test with workflow tests**

Modify `src/App.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { buildDownloadBlob, downloadBlob } from './lib/downloads';
import { renderPdfToPngs } from './lib/pdfRender';

vi.mock('./lib/pdfRender', () => ({
  renderPdfToPngs: vi.fn(),
}));

vi.mock('./lib/downloads', () => ({
  buildDownloadBlob: vi.fn(),
  downloadBlob: vi.fn(),
}));

const mockedRenderPdfToPngs = vi.mocked(renderPdfToPngs);
const mockedBuildDownloadBlob = vi.mocked(buildDownloadBlob);
const mockedDownloadBlob = vi.mocked(downloadBlob);

function pdfFile(name = '수업자료.pdf') {
  return new File(['%PDF-1.7'], name, { type: 'application/pdf' });
}

describe('App', () => {
  beforeEach(() => {
    mockedRenderPdfToPngs.mockReset();
    mockedBuildDownloadBlob.mockReset();
    mockedDownloadBlob.mockReset();
  });

  it('selects a PDF and converts it to PNG pages', async () => {
    const user = userEvent.setup();
    mockedRenderPdfToPngs.mockResolvedValue([
      {
        pageIndex: 0,
        fileName: '수업자료-00.png',
        blob: new Blob(['page-0'], { type: 'image/png' }),
        width: 764,
        height: 1080,
      },
      {
        pageIndex: 1,
        fileName: '수업자료-01.png',
        blob: new Blob(['page-1'], { type: 'image/png' }),
        width: 764,
        height: 1080,
      },
    ]);

    render(<App />);

    await user.upload(screen.getByLabelText('PDF 파일 선택'), pdfFile());
    await user.click(screen.getByRole('button', { name: 'PNG로 변환하기' }));

    await waitFor(() => {
      expect(screen.getByText('수업자료-00.png')).toBeInTheDocument();
      expect(screen.getByText('수업자료-01.png')).toBeInTheDocument();
    });

    expect(mockedRenderPdfToPngs).toHaveBeenCalledWith(
      expect.objectContaining({ name: '수업자료.pdf' }),
      expect.objectContaining({ targetLongEdge: 1080 }),
    );
  });

  it('downloads a zip when multiple PNG pages are ready', async () => {
    const user = userEvent.setup();
    const pages = [
      {
        pageIndex: 0,
        fileName: '수업자료-00.png',
        blob: new Blob(['page-0'], { type: 'image/png' }),
        width: 764,
        height: 1080,
      },
      {
        pageIndex: 1,
        fileName: '수업자료-01.png',
        blob: new Blob(['page-1'], { type: 'image/png' }),
        width: 764,
        height: 1080,
      },
    ];

    mockedRenderPdfToPngs.mockResolvedValue(pages);
    mockedBuildDownloadBlob.mockResolvedValue({
      fileName: '수업자료-png-1080p.zip',
      blob: new Blob(['zip'], { type: 'application/zip' }),
    });

    render(<App />);

    await user.upload(screen.getByLabelText('PDF 파일 선택'), pdfFile());
    await user.click(screen.getByRole('button', { name: 'PNG로 변환하기' }));
    await screen.findByText('수업자료-01.png');
    await user.click(screen.getByRole('button', { name: 'ZIP 다운로드' }));

    expect(mockedBuildDownloadBlob).toHaveBeenCalledWith('수업자료.pdf', pages);
    expect(mockedDownloadBlob).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: '수업자료-png-1080p.zip' }),
    );
  });

  it('rejects files that are not PDFs', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText('PDF 파일 선택'),
      new File(['text'], 'memo.txt', { type: 'text/plain' }),
    );

    expect(screen.getByRole('status')).toHaveTextContent('PDF 파일만 선택할 수 있습니다.');
  });
});
```

- [ ] **Step 2: Run workflow tests and confirm they fail**

Run:

```bash
npm test -- --run src/App.test.tsx
```

Expected:

```text
FAIL src/App.test.tsx
```

- [ ] **Step 3: Implement the file dropzone component**

Create `src/components/FileDropzone.tsx`:

```tsx
import { FileUp } from 'lucide-react';

type FileDropzoneProps = {
  selectedFile: File | null;
  onSelectFile: (file: File) => void;
  onRejectFile: (message: string) => void;
};

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function FileDropzone({ selectedFile, onSelectFile, onRejectFile }: FileDropzoneProps) {
  function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!isPdf(file)) {
      onRejectFile('PDF 파일만 선택할 수 있습니다.');
      return;
    }

    onSelectFile(file);
  }

  return (
    <section className="dropzone" aria-label="PDF 업로드">
      <FileUp aria-hidden="true" className="dropzone-icon" />
      <div>
        <h2>PDF 파일 선택</h2>
        <p>파일은 브라우저 안에서만 처리됩니다.</p>
      </div>
      <label className="file-button">
        PDF 파일 선택
        <input
          aria-label="PDF 파일 선택"
          accept="application/pdf,.pdf"
          type="file"
          onChange={(event) => handleFile(event.currentTarget.files?.[0])}
        />
      </label>
      {selectedFile ? <p className="selected-file">{selectedFile.name}</p> : null}
    </section>
  );
}
```

- [ ] **Step 4: Implement the conversion panel**

Create `src/components/ConversionPanel.tsx`:

```tsx
import { Loader2, RotateCcw, Wand2 } from 'lucide-react';
import type { ConversionProgress } from '../types/conversion';

type ConversionPanelProps = {
  selectedFile: File | null;
  isConverting: boolean;
  progress: ConversionProgress | null;
  onConvert: () => void;
  onReset: () => void;
};

export function ConversionPanel({
  selectedFile,
  isConverting,
  progress,
  onConvert,
  onReset,
}: ConversionPanelProps) {
  const progressText = progress
    ? `${progress.currentPage} / ${progress.totalPages} 페이지 변환 중`
    : '긴 변 1080px PNG로 변환합니다.';

  return (
    <section className="panel" aria-label="변환 설정">
      <div>
        <h2>1080p 변환</h2>
        <p>{progressText}</p>
      </div>
      <div className="button-row">
        <button className="primary-button" disabled={!selectedFile || isConverting} onClick={onConvert}>
          {isConverting ? <Loader2 aria-hidden="true" className="spin" /> : <Wand2 aria-hidden="true" />}
          PNG로 변환하기
        </button>
        <button className="ghost-button" disabled={isConverting && !selectedFile} onClick={onReset}>
          <RotateCcw aria-hidden="true" />
          초기화
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Implement the result list**

Create `src/components/ResultList.tsx`:

```tsx
import { Archive, Download } from 'lucide-react';
import type { RenderedPngPage } from '../types/conversion';

type ResultListProps = {
  pages: RenderedPngPage[];
  onDownload: () => void;
};

export function ResultList({ pages, onDownload }: ResultListProps) {
  if (pages.length === 0) {
    return null;
  }

  const downloadLabel = pages.length === 1 ? 'PNG 다운로드' : 'ZIP 다운로드';

  return (
    <section className="panel result-panel" aria-label="변환 결과">
      <div className="result-heading">
        <div>
          <h2>변환 완료</h2>
          <p>{pages.length}개의 PNG 파일이 준비되었습니다.</p>
        </div>
        <button className="primary-button" onClick={onDownload}>
          {pages.length === 1 ? <Download aria-hidden="true" /> : <Archive aria-hidden="true" />}
          {downloadLabel}
        </button>
      </div>
      <ul className="result-list">
        {pages.map((page) => (
          <li key={page.fileName}>
            <span>{page.fileName}</span>
            <span>
              {page.width} x {page.height}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 6: Wire the top-level app**

Modify `src/App.tsx`:

```tsx
import { useState } from 'react';
import { ConversionPanel } from './components/ConversionPanel';
import { FileDropzone } from './components/FileDropzone';
import { ResultList } from './components/ResultList';
import { buildDownloadBlob, downloadBlob } from './lib/downloads';
import { renderPdfToPngs } from './lib/pdfRender';
import type { ConversionProgress, RenderedPngPage } from './types/conversion';

const TARGET_LONG_EDGE = 1080;

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pages, setPages] = useState<RenderedPngPage[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [statusMessage, setStatusMessage] = useState('PDF 파일을 선택해 주세요.');

  function handleSelectFile(file: File) {
    setSelectedFile(file);
    setPages([]);
    setProgress(null);
    setStatusMessage(`${file.name} 파일이 선택되었습니다.`);
  }

  function handleReset() {
    setSelectedFile(null);
    setPages([]);
    setProgress(null);
    setStatusMessage('PDF 파일을 선택해 주세요.');
  }

  async function handleConvert() {
    if (!selectedFile) {
      setStatusMessage('먼저 PDF 파일을 선택해 주세요.');
      return;
    }

    setIsConverting(true);
    setPages([]);
    setStatusMessage('PDF를 PNG로 변환하고 있습니다.');

    try {
      const renderedPages = await renderPdfToPngs(selectedFile, {
        targetLongEdge: TARGET_LONG_EDGE,
        onProgress: setProgress,
      });
      setPages(renderedPages);
      setStatusMessage(`${renderedPages.length}개의 PNG 파일이 준비되었습니다.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '변환 중 오류가 발생했습니다.');
    } finally {
      setIsConverting(false);
    }
  }

  async function handleDownload() {
    if (!selectedFile || pages.length === 0) {
      setStatusMessage('다운로드할 PNG가 없습니다.');
      return;
    }

    const output = await buildDownloadBlob(selectedFile.name, pages);
    downloadBlob(output);
    setStatusMessage(`${output.fileName} 다운로드를 시작했습니다.`);
  }

  return (
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="app-title">
        <p className="eyebrow">브라우저 안에서 변환</p>
        <h1 id="app-title">PDF를 1080p PNG로 변환</h1>
        <p className="hero-copy">
          PDF 파일을 선택하면 각 페이지를 PNG로 만들고, 여러 장이면 ZIP으로 묶어 다운로드합니다.
        </p>
      </section>

      <section className="workspace" aria-label="PDF 변환 작업">
        <FileDropzone
          selectedFile={selectedFile}
          onSelectFile={handleSelectFile}
          onRejectFile={setStatusMessage}
        />
        <ConversionPanel
          selectedFile={selectedFile}
          isConverting={isConverting}
          progress={progress}
          onConvert={handleConvert}
          onReset={handleReset}
        />
        <ResultList pages={pages} onDownload={handleDownload} />
      </section>

      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>
    </main>
  );
}
```

- [ ] **Step 7: Verify the UI workflow tests**

Run:

```bash
npm test -- --run src/App.test.tsx
```

Expected:

```text
PASS src/App.test.tsx
```

- [ ] **Step 8: Commit the workflow UI**

Run:

```bash
git add src/App.tsx src/App.test.tsx src/components
git commit -m "feat: add pdf conversion workflow ui"
```

## Task 5: Visual Design, Responsive Layout, and Accessibility

**Files:**
- Modify: `src/App.css`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Add an accessibility regression test for live status**

Modify the `rejects files that are not PDFs` test in `src/App.test.tsx` so it asserts the live status region:

```tsx
expect(screen.getByRole('status')).toHaveTextContent('PDF 파일만 선택할 수 있습니다.');
```

- [ ] **Step 2: Replace the initial CSS with the full app styling**

Modify `src/App.css`:

```css
:root {
  color: #172026;
  background: #f7f5ef;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background:
    linear-gradient(135deg, rgba(42, 97, 93, 0.14), transparent 36%),
    linear-gradient(315deg, rgba(231, 102, 77, 0.14), transparent 34%),
    #f7f5ef;
}

button,
input {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.app-shell {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 56px 0;
}

.hero-panel {
  display: grid;
  gap: 16px;
  margin-bottom: 36px;
}

.eyebrow {
  margin: 0;
  color: #2a615d;
  font-size: 0.92rem;
  font-weight: 700;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 0;
  max-width: 780px;
  font-size: clamp(2.6rem, 8vw, 5.8rem);
  line-height: 0.95;
  letter-spacing: 0;
}

h2 {
  margin-bottom: 8px;
  font-size: 1.12rem;
  line-height: 1.2;
}

.hero-copy {
  margin-bottom: 0;
  max-width: 620px;
  color: #52615f;
  font-size: 1.12rem;
  line-height: 1.65;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
  gap: 18px;
  align-items: start;
}

.dropzone,
.panel {
  border: 1px solid rgba(23, 32, 38, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 42px rgba(23, 32, 38, 0.08);
}

.dropzone {
  display: grid;
  min-height: 320px;
  place-items: center;
  gap: 20px;
  padding: 36px;
  text-align: center;
}

.dropzone p,
.panel p {
  margin-bottom: 0;
  color: #5c6a68;
  line-height: 1.55;
}

.dropzone-icon {
  width: 52px;
  height: 52px;
  color: #2a615d;
}

.file-button,
.primary-button,
.ghost-button {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 750;
}

.file-button,
.primary-button {
  border: 1px solid #172026;
  background: #172026;
  color: #ffffff;
  padding: 0 18px;
}

.file-button input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.ghost-button {
  border: 1px solid rgba(23, 32, 38, 0.18);
  background: #ffffff;
  color: #172026;
  padding: 0 16px;
}

.selected-file {
  max-width: 100%;
  overflow-wrap: anywhere;
  font-weight: 700;
}

.panel {
  display: grid;
  gap: 18px;
  padding: 24px;
}

.button-row,
.result-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.primary-button svg,
.ghost-button svg {
  width: 18px;
  height: 18px;
}

.result-panel {
  grid-column: 1 / -1;
}

.result-list {
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.result-list li {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(23, 32, 38, 0.1);
  padding: 12px 0 4px;
  color: #34413f;
}

.result-list span:first-child {
  overflow-wrap: anywhere;
  font-weight: 700;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .app-shell {
    width: min(100% - 24px, 1120px);
    padding: 32px 0;
  }

  .workspace {
    grid-template-columns: 1fr;
  }

  .dropzone {
    min-height: 260px;
    padding: 28px 20px;
  }

  .button-row,
  .result-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .primary-button,
  .ghost-button {
    width: 100%;
  }
}
```

- [ ] **Step 3: Verify tests and type checks**

Run:

```bash
npm test -- --run
```

Expected:

```text
PASS
```

Run:

```bash
npm run lint
```

Expected:

```text
Found 0 errors.
```

- [ ] **Step 4: Commit visual and accessibility work**

Run:

```bash
git add src/App.css src/App.test.tsx
git commit -m "feat: polish responsive converter interface"
```

## Task 6: End-to-End Browser Verification

**Files:**
- No source changes required unless verification reveals a defect.

- [ ] **Step 1: Start the local dev server**

Run:

```bash
npm run dev
```

Expected:

```text
Local: http://localhost:5173/
```

- [ ] **Step 2: Verify the primary workflow in the in-app browser**

Open `http://localhost:5173/` and verify:

```text
1. The first viewport shows the PDF to PNG 1080p tool, not a marketing-only landing page.
2. The file input accepts a real PDF file.
3. Clicking "PNG로 변환하기" shows progress while pages render.
4. A one-page PDF produces one item named 원본이름-00.png and a "PNG 다운로드" button.
5. A multi-page PDF produces page names ending in -00.png, -01.png, -02.png and a "ZIP 다운로드" button.
6. The ZIP contains the generated PNG files with the same names shown in the UI.
7. A non-PDF file updates the live status with "PDF 파일만 선택할 수 있습니다."
8. Desktop and mobile viewports do not clip buttons, file names, or result rows.
```

- [ ] **Step 3: Run production checks**

Run:

```bash
npm run build
```

Expected:

```text
✓ built in
```

- [ ] **Step 4: Commit verification fixes if any source file changed**

Run only when verification changed files:

```bash
git add src
git commit -m "fix: address converter verification issues"
```

## Task 7: Documentation

**Files:**
- Create: `README.md`

- [ ] **Step 1: Add README**

Create `README.md`:

```md
# PDF to PNG 1080p

PDF 파일을 브라우저에서 1080p PNG 파일로 변환하는 웹앱입니다.

## 기능

- PDF 1개를 선택해 각 페이지를 PNG로 변환합니다.
- 출력 PNG는 원본 비율을 유지하고 긴 변을 1080px로 맞춥니다.
- 한 페이지 PDF는 `원본이름-00.png`로 다운로드합니다.
- 여러 페이지 PDF는 `원본이름-png-1080p.zip`으로 다운로드합니다.
- ZIP 내부 파일명은 `원본이름-00.png`, `원본이름-01.png` 형식입니다.
- PDF 파일은 서버로 업로드되지 않고 브라우저 안에서 처리됩니다.

## 개발

```bash
npm install
npm run dev
```

## 검증

```bash
npm test -- --run
npm run lint
npm run build
```
```

- [ ] **Step 2: Verify docs and final build**

Run:

```bash
npm test -- --run
npm run lint
npm run build
```

Expected:

```text
PASS
Found 0 errors.
✓ built in
```

- [ ] **Step 3: Commit documentation**

Run:

```bash
git add README.md
git commit -m "docs: document pdf to png converter"
```

## Self-Review

- Spec coverage: Upload PDF, 1080p PNG conversion, multi-page ZIP download, zero-based page numbering, original-name-based file naming, and browser download behavior are each covered by specific tasks.
- Placeholder scan: The plan contains concrete file paths, commands, expected outputs, and code blocks for every implementation task.
- Type consistency: `RenderedPngPage`, `ConversionProgress`, `renderPdfToPngs`, `buildDownloadBlob`, and `downloadBlob` are introduced before UI usage and referenced consistently.
- Scope check: v1 stays focused on one PDF at a time and client-only PNG/ZIP generation.

## Execution Choice

Plan complete and saved to `docs/superpowers/plans/2026-05-03-pdf-to-png-converter.md`. Two execution options:

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration. Per local instructions, subagents use `GPT-5.3-Codex-Spark`; orchestrator and review stay on the main model.

**2. Inline Execution** - Execute tasks in this session using `superpowers:executing-plans`, with checkpoints after meaningful slices.

