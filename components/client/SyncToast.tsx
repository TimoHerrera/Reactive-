export function SyncToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-32px)] max-w-[448px] -translate-x-1/2 rounded-md border border-danger bg-surface px-4 py-3 text-small font-medium text-danger-ink"
    >
      ✕ {message}
    </div>
  );
}
