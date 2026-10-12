"use client";

import { IconCheck, IconX } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export type StepState = "pending" | "running" | "done" | "failed";
export type ReadingStep = { label: string; state: StepState };

function SheetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16M4 15h16M10 4v16" />
    </svg>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "done")
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-bg">
        <IconCheck className="h-4 w-4" />
      </span>
    );
  if (state === "failed")
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-danger text-ink">
        <IconX className="h-4 w-4" />
      </span>
    );
  if (state === "running") return <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-accent" />;
  return <span className="h-8 w-8 rounded-full border-2 border-line" />;
}

/** «Leyendo tu planilla…» con los pasos reales. */
export function ImportReading({
  fileName,
  sizeKb,
  rows,
  progress,
  steps,
}: {
  fileName: string;
  sizeKb: number;
  rows: number | null;
  progress: number;
  steps: ReadingStep[];
}) {
  return (
    <div className="bg-grid flex min-h-[calc(100dvh-90px)] flex-col px-gutter pb-8 pt-8" aria-live="polite">
      <h1 className="display text-display-xl">
        Leyendo
        <br />
        tu planilla…
      </h1>
      <section className="mt-6 rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-ink text-bg">
            <SheetIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-title-sm">{fileName}</p>
            <p className="text-small text-muted">
              {sizeKb} KB{rows !== null ? ` · ${rows} filas` : ""}
            </p>
          </div>
          <p className="display shrink-0 text-h2">{Math.round(progress * 100)}%</p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
      </section>
      <ol className="mt-6 space-y-4">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-3">
            <StepIcon state={s.state} />
            <span className={cn("text-body", s.state === "pending" ? "text-muted" : "text-ink")}>{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="mt-auto pt-10 text-center text-small text-muted">Tarda unos segundos. Ni copiar ni pegar: cada fila se revisa.</p>
    </div>
  );
}
