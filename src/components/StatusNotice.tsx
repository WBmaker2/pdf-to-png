import { CircleAlert, CircleCheck, Info } from "lucide-react";

export type StatusTone = "info" | "success" | "error";

type StatusNoticeProps = {
  tone: StatusTone;
  message: string;
};

const statusIcons = {
  info: Info,
  success: CircleCheck,
  error: CircleAlert,
} as const;

export function StatusNotice({ tone, message }: StatusNoticeProps) {
  const Icon = statusIcons[tone];

  return (
    <div
      className={`status-message status-message--${tone}`}
      role="status"
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <Icon aria-hidden="true" data-testid="status-icon" />
      <span className="status-message-text" data-testid="status-message-text">
        {message}
      </span>
    </div>
  );
}

export default StatusNotice;
