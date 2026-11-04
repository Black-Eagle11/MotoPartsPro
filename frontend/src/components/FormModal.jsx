
import {
  useEffect,
  useId,
  useRef,
} from "react";

const MODAL_WIDTHS = {
  sm: "400px",
  md: "600px",
  lg: "800px",
  xl: "1000px",
};

export default function FormModal({
  isOpen = false,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousActiveElement = document.activeElement;
    const dialog = dialogRef.current;

    dialog?.focus();

    function getFocusableElements() {
      if (!dialog) {
        return [];
      }

      return Array.from(
        dialog.querySelectorAll(
          [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
          ].join(","),
        ),
      ).filter(
        (element) =>
          !element.hasAttribute("hidden") &&
          element.getAttribute("aria-hidden") !== "true",
      );
    }

    function handleKeyDown(event) {
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements();

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement =
        focusableElements[focusableElements.length - 1];

      if (
        event.shiftKey &&
        (
          document.activeElement === firstElement ||
          document.activeElement === dialog
        )
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === lastElement
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, [isOpen, closeOnEscape]);

  if (!isOpen) {
    return null;
  }

  const maxWidth = MODAL_WIDTHS[size] ?? MODAL_WIDTHS.md;

  function handleBackdropMouseDown(event) {
    if (
      closeOnBackdrop &&
      event.target === event.currentTarget
    ) {
      onClose?.();
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        ref={dialogRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        style={{ maxWidth }}
      >
        <header className="card-header">
          <div>
            <h2
              id={titleId}
              className="card-title"
            >
              {title}
            </h2>

            {description && (
              <p
                id={descriptionId}
                className="page-description"
              >
                {description}
              </p>
            )}
          </div>

          {showCloseButton && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              aria-label="Tutup dialog"
            >
              Tutup
            </button>
          )}
        </header>

        <div className="modal-body">
          {children}
        </div>

        {footer && (
          <>
            <hr className="divider" />

            <footer className="form-actions">
              {footer}
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
