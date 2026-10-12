"use client";

/** Error de carga: nunca se muestra como «vacío». Ofrece reintentar. */
export function QueryError({ onRetry, what = "los datos" }: { onRetry: () => void; what?: string }) {
  return (
    <div role="alert" className="rounded-lg border border-danger/60 bg-danger/10 p-4 text-center">
      <p className="text-body">No pudimos cargar {what}.</p>
      <button type="button" onClick={onRetry} className="mt-3 h-11 rounded-full bg-ink px-5 text-small font-bold text-bg">
        Reintentar
      </button>
    </div>
  );
}
