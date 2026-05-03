import type { ConversionProgress } from "../types/conversion";
import { Loader2, RotateCcw, Wand2 } from "lucide-react";

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
  const progressText =
    progress
      ? `${progress.currentPage} / ${progress.totalPages} 페이지 변환 중`
      : "긴 변 1080px PNG로 변환합니다.";

  return (
    <section className="panel" aria-label="변환 설정">
      <div>
        <h2>1080p 변환</h2>
        <p>{progressText}</p>
      </div>
      <div className="button-row">
        <button
          type="button"
          className="primary-button"
          disabled={!selectedFile || isConverting}
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
          disabled={isConverting && !selectedFile}
          onClick={onReset}
        >
          <RotateCcw aria-hidden="true" />
          초기화
        </button>
      </div>
    </section>
  );
}

export default ConversionPanel;
