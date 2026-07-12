import { useEffect, useRef, useState } from "react";
import { History, X } from "lucide-react";
import { UPDATE_HISTORY } from "../data/updateHistory";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function UpdateHistoryDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  function closeDialog() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;
      const focusableElements = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusableElements || focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const isFocusInsideDialog = dialog?.contains(document.activeElement);

      if (!isFocusInsideDialog) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const trigger = (
    <button
      ref={triggerRef}
      className="update-history-trigger"
      type="button"
      onClick={() => setIsOpen(true)}
    >
      <History aria-hidden="true" />
      <span>업데이트 내역</span>
    </button>
  );

  if (!isOpen) {
    return trigger;
  }

  return (
    <>
      {trigger}
      <div
        className="update-history-backdrop"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeDialog();
          }
        }}
      >
        <div
          ref={dialogRef}
          className="update-history-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-history-title"
        >
          <div className="update-history-header">
            <h2 id="update-history-title">업데이트 내역</h2>
            <button
              ref={closeButtonRef}
              className="icon-button"
              type="button"
              aria-label="업데이트 내역 닫기"
              onClick={closeDialog}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="update-history-body">
            <ol className="update-history-list">
              {UPDATE_HISTORY.map((entry) => (
                <li key={entry.date} className="update-history-entry">
                  <time dateTime={entry.date}>{entry.date}</time>
                  <h3>{entry.title}</h3>
                  <ul>
                    {entry.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
