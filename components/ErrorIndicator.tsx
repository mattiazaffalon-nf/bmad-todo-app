"use client";

import { AlertCircle, RotateCw } from "lucide-react";

interface ErrorIndicatorProps {
  onRetry: () => void;
  retrying: boolean;
}

export function ErrorIndicator({ onRetry, retrying }: ErrorIndicatorProps) {
  return (
    <button
      type="button"
      aria-label="Couldn't save, tap to retry"
      onClick={onRetry}
      className="flex items-center gap-1.5 min-w-[44px] min-h-[44px] px-1 text-error-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {retrying ? (
        <RotateCw
          size={16}
          aria-hidden="true"
          className="flex-shrink-0 animate-spin motion-reduce:animate-none"
        />
      ) : (
        <AlertCircle size={16} aria-hidden="true" className="flex-shrink-0" />
      )}
      <span className="text-sm whitespace-nowrap">Couldn&apos;t save — tap to retry</span>
    </button>
  );
}
