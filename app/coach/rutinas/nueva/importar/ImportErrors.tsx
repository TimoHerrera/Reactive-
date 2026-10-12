"use client";

import { PillButton } from "@/components/ui";
import { IconX } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { Issue } from "@/lib/import/parse";
import { downloadTemplate } from "@/lib/import/template";

/** «No pudimos leer tu archivo». */
export function ImportErrors({ fileName, issues, onRetry }: { fileName: string; issues: Issue[]; onRetry: () => void }) {
  const count = issues.length;
  return (
    <div className="px-gutter pb-48 pt-6">
      <span className="flex h-11 w-[72px] items-center justify-center rounded-full border-2 border-danger bg-danger/15 text-[1.5rem] text-danger-ink">
        <IconX />
      </span>
      <h1 className="display mt-5 text-[3.25rem]">
        No pudimos
        <br />
        leer tu archivo
      </h1>
      <section className="mt-6 flex items-center gap-3 rounded-lg border border-line bg-surface p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M4 10h16M4 15h16M10 4v16" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="truncate text-title-sm">{fileName}</p>
          <p className="text-small text-muted">
            {count} {count === 1 ? "problema encontrado" : "problemas encontrados"}
          </p>
        </div>
      </section>
      <ul className="mt-4 space-y-3">
        {issues.map((it, i) => (
          <li
            key={i}
            className={cn(
              "flex gap-3 rounded-lg border bg-surface p-4",
              it.kind === "error" ? "border-danger/70" : "border-warning/70",
            )}
          >
            <span className={cn("font-bold", it.kind === "error" ? "text-danger" : "text-warning")} aria-hidden="true">
              {it.kind === "error" ? "✕" : "!"}
            </span>
            <div>
              <p className="text-title-sm">{it.title}</p>
              <p className="mt-0.5 text-small text-muted">{it.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="display mt-5 rounded-md bg-danger py-3 text-center text-[1.375rem]">Corregí y volvé a subir</p>

      <footer className="fixed bottom-0 left-1/2 z-30 w-full max-w-phone -translate-x-1/2 space-y-3 border-t border-line bg-bg/95 px-gutter pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <PillButton block arrow onClick={onRetry}>
          Subir otro archivo
        </PillButton>
        <PillButton block variant="outline" size="md" onClick={() => downloadTemplate()}>
          Descargar plantilla
        </PillButton>
      </footer>
    </div>
  );
}
