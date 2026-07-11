import { useEffect, useState } from "react";
import { Archive, Download, Loader2 } from "lucide-react";
import type { RenderedPngPage } from "../types/conversion";

type ResultListProps = {
  pages: RenderedPngPage[];
  isDownloading: boolean;
  downloadProgress: number;
  onDownload: () => void;
};

type ResultItemProps = {
  page: RenderedPngPage;
};

function ResultItem({ page }: ResultItemProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(page.blob);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [page.blob]);

  return (
    <li className="result-card">
      <div className="result-thumbnail">
        {previewUrl ? (
          <img
            alt={`${page.fileName} 미리보기`}
            decoding="async"
            loading="lazy"
            src={previewUrl}
          />
        ) : null}
      </div>
      <div className="result-details">
        <span className="result-file-name">{page.fileName}</span>
        <span className="result-dimensions">
          {page.width} x {page.height}
        </span>
      </div>
    </li>
  );
}

export function ResultList({
  pages,
  isDownloading,
  downloadProgress,
  onDownload,
}: ResultListProps) {
  const downloadLabel = pages.length === 1 ? "PNG 다운로드" : "ZIP 다운로드";
  const hasResults = pages.length > 0;

  return (
    <section
      className="workflow-band result-panel"
      aria-label="변환 결과"
      aria-busy={isDownloading}
    >
      <div className="result-heading">
        <div>
          <span className="band-step">3. 결과</span>
          <h2>{hasResults ? "변환 완료" : "변환 결과"}</h2>
          <p>
            {hasResults
              ? `${pages.length}개의 PNG 파일이 준비되었습니다.`
              : "아직 변환 결과가 없습니다."}
          </p>
        </div>
        {hasResults ? (
          <button
            type="button"
            className="primary-button"
            disabled={isDownloading}
            onClick={onDownload}
          >
            {isDownloading ? (
              <Loader2 aria-hidden="true" className="spin" />
            ) : pages.length === 1 ? (
              <Download aria-hidden="true" />
            ) : (
              <Archive aria-hidden="true" />
            )}
            {isDownloading ? `ZIP 생성 중 ${downloadProgress}%` : downloadLabel}
          </button>
        ) : null}
      </div>
      {isDownloading && (
        <div className="download-progress">
          <progress
            aria-label="ZIP 파일 생성 진행률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={downloadProgress}
            max={100}
            value={downloadProgress}
          >
            {downloadProgress}%
          </progress>
          <p className="sr-only" role="status">
            ZIP 파일 생성 진행률 {downloadProgress}%
          </p>
        </div>
      )}
      {hasResults ? (
        <ul className="result-list">
          {pages.map((page) => (
            <ResultItem key={page.fileName} page={page} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default ResultList;
