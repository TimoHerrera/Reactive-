"use client";

import { useRef, useState, type DragEvent } from "react";
import { BrushNote, PillButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ACCEPT_IMPORT, MAX_IMPORT_MB } from "@/lib/import/read";
import { downloadTemplate, TEMPLATE_HEADERS, TEMPLATE_ROWS } from "@/lib/import/template";

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
      <path d="M12 19V8M7 13l5-5 5 5M5 4h14" />
    </svg>
  );
}

/** Paso 1: «Usá nuestra plantilla» + «Subí tu archivo». */
export function ImportStart({ onFile, error }: { onFile: (f: File) => void; error: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div className="space-y-5 px-gutter pb-10 pt-6">
      <h1 className="display text-display-section">Importar Excel</h1>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="flex items-center gap-3 text-title-sm">
          <span className="display flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[1.25rem] text-bg">1</span>
          Usá nuestra plantilla
        </h2>
        <p className="mt-3 text-body text-title">Una fila por ejercicio. Respetá estas columnas:</p>
        <div className="mt-3 overflow-x-auto rounded-md border border-line" tabIndex={0} aria-label="Columnas de la plantilla">
          <table className="w-full min-w-[620px] text-left text-small">
            <thead>
              <tr className="bg-surface-2">
                {TEMPLATE_HEADERS.map((h) => (
                  <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold text-title">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {TEMPLATE_ROWS[0]!.map((c, i) => (
                  <td key={i} className="whitespace-nowrap border-t border-line px-3 py-2">
                    {c}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <PillButton variant="inverse" block className="mt-4" onClick={() => downloadTemplate()}>
          <span className="inline-flex items-center gap-2">
            <DownloadIcon /> Descargar plantilla
          </span>
        </PillButton>
      </section>

      <section>
        <h2 className="flex items-center gap-3 text-title-sm">
          <span className="display flex h-9 w-9 items-center justify-center rounded-full bg-accent text-[1.25rem]">2</span>
          Subí tu archivo
        </h2>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cn(
            "mt-3 flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 text-center transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-ink",
            over ? "border-accent bg-accent-deep/30" : "border-accent/70 bg-accent-deep/10 hover:bg-accent-deep/20",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_IMPORT}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-ink">
            <UploadIcon />
          </span>
          <span className="display mt-4 text-h2">Tocá para elegir</span>
          <span className="mt-1 text-small text-muted">.xlsx o .csv · hasta {MAX_IMPORT_MB} MB</span>
        </label>
        <p className="mt-3 text-small text-muted">
          ¿Armás tus rutinas con una hoja por día y bloques («Bloque 1 | Repeticiones | Series | Carga | Pausa»)? También las
          leemos.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-small font-medium text-danger-ink">
            ✕ {error}
          </p>
        )}
      </section>

      <BrushNote title="">
        <span className="font-semibold">
          <strong className="display mr-1 text-[1.125rem]">Tip:</strong>si escribís «RDL» o «Nordic curl», lo reconocemos por sus alias de la
          biblioteca.
        </span>
      </BrushNote>
    </div>
  );
}
