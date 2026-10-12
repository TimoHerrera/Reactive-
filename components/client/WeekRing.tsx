import { cn } from "@/lib/cn";
import type { WeekDot } from "@/lib/routine/progress";

/** «2/3 sesiones hechas» con anillo de progreso y puntos L M M J V S D. */
export function WeekRing({ completed, target, dots }: { completed: number; target: number; dots: WeekDot[] }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const pct = target ? Math.min(1, completed / target) : 0;
  return (
    <div>
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 72 72" className="h-[72px] w-[72px] shrink-0" role="img" aria-label={`${completed} de ${target} sesiones hechas esta semana`}>
          <circle cx="36" cy="36" r={r} fill="none" stroke="#222222" strokeWidth="8" />
          <circle
            cx="36"
            cy="36"
            r={r}
            fill="none"
            stroke="#2457E6"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
            transform="rotate(-90 36 36)"
          />
          <text x="36" y="43" textAnchor="middle" className="fill-ink font-display text-[20px] font-extrabold italic">
            {completed}/{target}
          </text>
        </svg>
        <p className="text-small text-muted">
          sesiones
          <br />
          hechas
        </p>
      </div>
      <ul className="mt-4 flex justify-between" aria-label="Días de esta semana">
        {dots.map((d) => (
          <li key={d.date} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "h-3.5 w-3.5 rounded-full",
                d.state === "done" && "bg-success",
                d.state === "today" && "border-2 border-accent",
                d.state === "none" && "bg-surface-2",
              )}
              aria-label={d.state === "done" ? "entrenó" : d.state === "today" ? "hoy" : undefined}
            />
            <span className={cn("text-[0.625rem] font-bold", d.state === "today" ? "text-ink" : "text-muted")}>{d.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
