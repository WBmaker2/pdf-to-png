import type { ConversionProgress } from "../types/conversion";
import { Loader2, RotateCcw, Wand2 } from "lucide-react";

type ConversionPanelProps = {
  selectedFile: File | null;
  isConverting: boolean;
  isDownloading: boolean;
  isValidating: boolean;
  progress: ConversionProgress | null;
  canReset: boolean;
  onConvert: () => void;
  onReset: () => void;
};

export function ConversionPanel({
  selectedFile,
  isConverting,
  isDownloading,
  isValidating,
  progress,
  canReset,
  onConvert,
  onReset,
}: ConversionPanelProps) {
  const currentPage = progress?.currentPage ?? 0;
  const totalPages = progress?.totalPages ?? 1;
  const progressText = progress
    ? `${progress.currentPage} / ${progress.totalPages} 페이지 변환 중`
    : "변환을 준비하고 있습니다.";
  const isBusy = isConverting || isDownloading || isValidating;

  return (
    <section
      className="workflow-band conversion-panel"
      aria-label="변환 설정"
      aria-busy={isBusy}
    >
      <div className="band-heading">
        <div>
          <span className="band-step">2. 변환</span>
          <h2>PNG 변환</h2>
          <p>
            {isDownloading
              ? "ZIP 파일을 생성하는 동안 새 변환을 시작할 수 없습니다."
              : "긴 변 1080px PNG로 변환합니다."}
          </p>
        </div>
      </div>
      {isConverting ? (
        <div className="conversion-progress">
          <progress
            aria-label="PDF 변환 진행률"
            aria-valuemin={0}
            aria-valuemax={totalPages}
            aria-valuenow={currentPage}
            max={totalPages}
            value={currentPage}
          >
            {progressText}
          </progress>
          <p role="status">{progressText}</p>
        </div>
      ) : null}
      <div className="button-row">
        <button
          type="button"
          className="primary-button"
          disabled={!selectedFile || isBusy}
          onClick={onConvert}
        >
          {isConverting ? (
            <Loader2 aria-hidden="true" className="spin" />
          ) : (
            <Wand2 aria-hidden="true" />
          )}
          PNG로 변환하기
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={!canReset}
          onClick={onReset}
        >
          <RotateCcw aria-hidden="true" />
          {isConverting ? "변환 취소" : "초기화"}
        </button>
      </div>
    </section>
  );
}

export default ConversionPanel;
