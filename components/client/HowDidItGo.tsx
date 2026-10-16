"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import type { SetLogInput } from "@/lib/data/repositories";
import type { RoutineItem, SetLog } from "@/lib/data/types";
import { effortLabel, RPE_HELP } from "@/lib/routine/effort";
import { draftSetLogs } from "@/lib/routine/setlogs";

const RPES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const cell = "h-11 w-full rounded-sm border border-line bg-bg px-2 text-body font-semibold text-ink outline-none focus:border-accent";

/**
 * «¿Cómo te fue?»: panel rápido y opcional que aparece al marcar un ejercicio.
 * Una fila por serie con lo planificado precargado; RPE real del 1 al 10 y un comentario.
 */
export function HowDidItGo({
  name,
  item,
  previous,
  onSave,
  onSkip,
  onClose,
}: {
  name: string;
  item: Pick<RoutineItem, "sets" | "reps" | "load" | "rpeTarget" | "rirTarget">;
  previous?: SetLog[];
  onSave: (logs: SetLogInput[]) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<SetLogInput[]>(() => draftSetLogs(item, previous));
  const [note, setNote] = useState(previous?.find((l) => l.note)?.note ?? "");
  const set = (i: number, patch: Partial<SetLogInput>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const target = effortLabel(item);

  const save = () => onSave(rows.map((r, i) => ({ ...r, note: i === 0 ? note : null })));

  return (
    <Sheet title="¿Cómo te fue?" subtitle={<>{name}{target ? ` · objetivo ${target}` : ""}</>} onClose={onClose}>
      <p className="text-small text-muted">Es opcional: si no querés anotar nada, tocá «Saltear».</p>
      <table className="mt-3 w-full border-separate border-spacing-y-2 text-left">
        <thead>
          <tr className="label text-[0.6875rem]">
            <th scope="col" className="w-12 font-bold">Serie</th>
            <th scope="col" className="font-bold">Reps</th>
            <th scope="col" className="font-bold">Carga</th>
            <th scope="col" className="w-[4.5rem] font-bold">RPE</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.setNumber}>
              <th scope="row" className="display pr-2 text-[1.5rem] text-title">
                {r.setNumber}
              </th>
              <td className="pr-2">
                <input aria-label={`Reps serie ${r.setNumber}`} value={r.reps ?? ""} onChange={(e) => set(i, { reps: e.target.value })} className={cell} />
              </td>
              <td className="pr-2">
                <input aria-label={`Carga serie ${r.setNumber}`} value={r.load ?? ""} onChange={(e) => set(i, { load: e.target.value })} className={cell} />
              </td>
              <td>
                <select
                  aria-label={`RPE serie ${r.setNumber}`}
                  value={r.rpe ?? ""}
                  onChange={(e) => set(i, { rpe: e.target.value ? Number(e.target.value) : null })}
                  className={cn(cell, "[color-scheme:dark]")}
                >
                  <option value="">–</option>
                  {RPES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-caption text-muted">{RPE_HELP}</p>
      <label className="mt-4 block">
        <span className="label mb-1 block text-[0.6875rem]">Comentario</span>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder="Ej.: la última serie me costó, sentí el tobillo"
          className="w-full rounded-md border border-line bg-bg px-3 py-2 text-body text-ink outline-none placeholder:text-muted/70 focus:border-accent"
        />
      </label>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={onSkip} className="h-12 rounded-full border border-line font-semibold text-title hover:bg-surface-2">
          Saltear
        </button>
        <button type="button" data-autofocus onClick={save} className="h-12 rounded-full bg-accent font-bold text-ink hover:bg-[#2b60f0]">
          Guardar y marcar
        </button>
      </div>
    </Sheet>
  );
}
