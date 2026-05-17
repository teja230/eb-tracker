import { useCallback, useEffect, useRef, useState } from "react";

import { MessageSquare, X } from "lucide-react";

import { AskEBTracker } from "./AskEBTracker";
import type { AskEBTrackerProps } from "./trackerTypes";

// ─── FLOATING CHAT WIDGET ─────────────────────────────────────────────────────
// Fixed bottom-right launcher, independent of any page section.

export function FloatingChatWidget(props: Omit<AskEBTrackerProps, "onClose">) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap: constrain Tab/Shift+Tab inside the panel when open
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const getFocusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )
      );

    // Move focus into the panel after it mounts
    const firstFocusable = getFocusable()[0];
    firstFocusable?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  // Restore focus to toggle button when panel closes
  useEffect(() => {
    if (!open) {
      toggleBtnRef.current?.focus();
    }
  }, [open]);

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col items-end gap-3 pointer-events-none sm:bottom-6 sm:left-auto sm:right-6">
      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Ask EBTracker chat"
          className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[380px]"
          style={{ maxHeight: "min(580px, calc(100dvh - 100px))" }}
        >
          <AskEBTracker {...props} onClose={close} />
        </div>
      )}

      {/* Toggle button */}
      <button
        ref={toggleBtnRef}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? "Close chat" : "Ask EBTracker"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl ring-4 ring-white transition-all hover:bg-slate-700 active:scale-95"
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageSquare className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}
