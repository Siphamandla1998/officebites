import { FiX } from "react-icons/fi";
import { useEffect } from "react";

/**
 * Mobile-first modal that renders as a bottom sheet on small screens
 * and a centered card on larger ones.
 */
export default function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => (document.body.style.overflow = "");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-app sm:max-w-md bg-paper-raised rounded-t-2xl sm:rounded-2xl shadow-float animate-sheet-up sm:animate-fade-in max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="btn-icon" aria-label="Close">
            <FiX size={18} />
          </button>
        </div>
        <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-line shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
