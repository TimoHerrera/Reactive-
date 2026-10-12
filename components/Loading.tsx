// Estado de carga del diseño: skeleton + «CALENTANDO MOTORES…»
export function Loading({ label = "Calentando motores…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <div className="bg-grid px-gutter pb-6 pt-10">
        <div className="h-4 w-1/2 rounded-sm bg-surface-2" />
        <div className="mt-3 h-12 w-[78%] rounded-md bg-surface-2" />
        <div className="mt-3 h-4 w-[55%] rounded-sm bg-surface-2" />
      </div>
      <div className="px-gutter">
        <div className="rounded-lg border border-line bg-surface p-4 pt-[150px]">
          <div className="h-9 w-3/4 rounded-md bg-surface-2" />
          <div className="mt-3 h-4 w-1/2 rounded-sm bg-surface-2" />
          <div className="mt-5 flex h-16 items-center justify-center rounded-full bg-accent-deep/70">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-transparent" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="h-40 rounded-lg border border-line bg-surface" />
          <div className="h-40 rounded-lg border border-line bg-surface" />
        </div>
      </div>
      <p className="label mt-8 text-center">{label}</p>
    </div>
  );
}

export function InlineLoading({ label = "Calentando motores…" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-16">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-transparent" />
      <p className="label">{label}</p>
    </div>
  );
}
