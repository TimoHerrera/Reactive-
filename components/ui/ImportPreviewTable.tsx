import { cn } from "@/lib/cn";

export type PreviewRowStatus = "ok-video" | "ok-sin-video" | "revisar" | "no-encontrado";

export type PreviewRow = {
  key: string;
  day: string;
  order: number | string;
  block: string;
  sets: number | string;
  exercise: string;
  reps: string;
  load: string;
  status: PreviewRowStatus;
  /** Sugerencia para «revisar»: «¿Peso muerto rumano?» */
  suggestion?: string;
};

function StatusCell({ row }: { row: PreviewRow }) {
  switch (row.status) {
    case "ok-video":
      return <span className="font-semibold text-success">✓ con video</span>;
    case "ok-sin-video":
      return <span className="font-semibold text-success">✓ sin video</span>;
    case "revisar":
      return (
        <span className="font-semibold text-warning">! {row.suggestion ? `¿${row.suggestion}?` : "Revisar"}</span>
      );
    case "no-encontrado":
      return <span className="font-semibold text-danger-ink">✕ No encontrado</span>;
  }
}

// Tabla de vista previa del Excel. En mobile: scroll horizontal dentro de la card.
export function ImportPreviewTable({ rows, className }: { rows: PreviewRow[]; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-line bg-surface", className)} tabIndex={0}>
      <table className="w-full min-w-[640px] border-collapse text-left text-small">
        <thead>
          <tr className="border-b border-line">
            {["Día", "Orden", "Bloque", "S", "Ejercicio", "Reps", "Carga", "Estado"].map((h) => (
              <th key={h} scope="col" className="label whitespace-nowrap px-3 py-3 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className={cn(
                "border-b border-line last:border-0",
                r.status === "revisar" && "bg-warning/[.06]",
                r.status === "no-encontrado" && "bg-danger/[.08]",
              )}
            >
              <td className="px-3 py-3">{r.day}</td>
              <td className="px-3 py-3">{r.order}</td>
              <td className="px-3 py-3 text-title">{r.block}</td>
              <td className="px-3 py-3">{r.sets}</td>
              <td className="whitespace-nowrap px-3 py-3 font-semibold">{r.exercise}</td>
              <td className="px-3 py-3">{r.reps}</td>
              <td className="whitespace-nowrap px-3 py-3">{r.load || "—"}</td>
              <td className="whitespace-nowrap px-3 py-3">
                <StatusCell row={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
