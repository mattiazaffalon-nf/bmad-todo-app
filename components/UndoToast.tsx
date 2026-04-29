"use client";

import { useEffect } from "react";

interface UndoToastProps {
  visible: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ visible, onUndo, onDismiss }: UndoToastProps) {
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.isComposing) return;
      const target = e.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      onDismiss();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [visible, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={[
        "flex items-center justify-between gap-4",
        "min-w-[240px] max-w-[320px] h-11 px-4 rounded-full",
        "bg-surface border border-border-subtle",
        "motion-reduce:transition-none",
        visible ? "" : "pointer-events-none",
      ].join(" ")}
      style={{
        visibility: visible ? "visible" : "hidden",
        opacity: visible ? 1 : 0,
        transition: visible
          ? "none"
          : "opacity 200ms ease-in, visibility 0s 200ms",
      }}
    >
      <span className="text-sm text-foreground-muted">Task deleted</span>
      <button
        type="button"
        onClick={onUndo}
        className="text-sm text-accent-foreground font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Undo
      </button>
    </div>
  );
}
