export function EmptyState() {
  return (
    <div aria-live="polite" id="empty-state-hint" className="w-full max-w-[640px] mx-auto px-6 py-3">
      <p className="text-sm text-foreground-muted">
        <span className="lg:hidden">Tap to add your first task</span>
        <span className="hidden lg:block">Type a task and press Enter</span>
      </p>
    </div>
  );
}
