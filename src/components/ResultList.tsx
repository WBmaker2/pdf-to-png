import { Archive, Download, Loader2 } from "lucide-react";
import type { RenderedPngPage } from "../types/conversion";

type ResultListProps = {
  pages: RenderedPngPage[];
  isDownloading: boolean;
  downloadProgress: number;
  onDownload: () => void;
};

export function ResultList({
  pages,
  isDownloading,
  downloadProgress,
  onDownload,
}: ResultListProps) {
  if (pages.length === 0) {
    return null;
  }

  const downloadLabel = pages.length === 1 ? "PNG 다운로드" : "ZIP 다운로드";

  return (
    <section className="panel result-panel" aria-label="변환 결과">
      <div className="result-heading">
        <div>
          <h2>변환 완료</h2>
          <p>{pages.length}개의 PNG 파일이 준비되었습니다.</p>
        </div>
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

export default ResultList;
