export type UpdateHistoryEntry = {
  date: string;
  title: string;
  details: string[];
};

export const UPDATE_HISTORY: UpdateHistoryEntry[] = [
  {
    date: "2026-07-12",
    title: "안정성 및 사용성 개선",
    details: [
      "대용량 PDF 보호와 취소 가능한 ZIP 생성을 추가했습니다.",
      "PDF 검증, 드래그앤드롭, 미리보기와 접근성을 개선했습니다.",
      "실제 PDF 브라우저 테스트와 최신 의존성 검증을 추가했습니다.",
      "앱 종료와 PDF 페이지 처리 중 취소 안정성을 강화했습니다.",
      "좁은 화면에서 제목과 업데이트 버튼 배치를 다듬었습니다.",
      "Linux 환경의 모바일 헤더와 다운로드 안정성을 개선했습니다.",
    ],
  },
  {
    date: "2026-05-03",
    title: "최초 개발",
    details: [
      "PDF 각 페이지를 긴 변 1080px PNG로 변환하는 기능을 만들었습니다.",
      "여러 페이지 결과를 페이지 번호 파일명으로 묶어 ZIP으로 내려받도록 했습니다.",
    ],
  },
];
