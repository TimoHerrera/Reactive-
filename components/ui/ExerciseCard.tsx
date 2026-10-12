import Link from "next/link";
import { cn } from "@/lib/cn";
import { IconCheck, IconPlay } from "./icons";

export type ExerciseChip = { text: string; muted?: boolean };

type Props = {
  number: number;
  name: string;
  /** Si hay video: el nombre es un link (subrayado azul + ▶). Sin video no es tocable. */
  href?: string;
  chips?: ExerciseChip[];
  note?: string;
  done?: boolean;
  onToggle?: () => void;
  id?: string;
  className?: string;
};

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// Card de ejercicio · con video / sin video / hecho
export function ExerciseCard({ number, name, href, chips = [], note, done, onToggle, id, className }: Props) {
  const nameEl = href ? (
    <Link
      href={href}
      className={cn(
        "group -my-2 flex min-h-[44px] w-full items-center gap-2 py-2 text-left",
        done ? "text-title" : "text-ink",
      )}
    >
      <span
        className={cn(
          "text-title-sm underline decoration-[3px] underline-offset-[5px]",
          done ? "decoration-accent-deep" : "decoration-accent",
        )}
      >
        {name}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] text-ink",
          done ? "bg-accent-deep" : "bg-accent",
        )}
      >
        <IconPlay />
      </span>
      <span className="sr-only">· ver video</span>
    </Link>
  ) : (
    <p className={cn("py-0.5 text-title-sm", done ? "text-title" : "text-ink")}>{name}</p>
  );

  return (
    <article
      id={id}
      className={cn(
        "flex gap-3 rounded-lg border border-line p-4 transition-colors",
        done ? "bg-surface/60" : "bg-surface",
        className,
      )}
    >
      <span className="display w-8 shrink-0 pt-0.5 text-[1.75rem] text-line" aria-hidden="true">
        {pad2(number)}
      </span>
      <div className="min-w-0 flex-1">
        {nameEl}
        {chips.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((c, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-sm bg-surface-2 px-2.5 py-1 text-small font-semibold",
                  c.muted || done ? "text-muted" : "text-ink",
                )}
              >
                {c.text}
              </li>
            ))}
          </ul>
        )}
        {note && (
          <p className={cn("mt-3 text-small", done ? "text-muted" : "text-title")}>
            <strong className="font-bold text-ink">Profe:</strong> {note}
          </p>
        )}
      </div>
      {onToggle !== undefined && (
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={!!done}
          aria-label={done ? `Desmarcar ${name}` : `Marcar ${name} como hecho`}
          className={cn(
            "mt-6 flex h-12 w-12 shrink-0 items-center justify-center self-start rounded-full transition-colors",
            done ? "bg-success text-bg" : "border-2 border-line text-transparent hover:border-muted",
          )}
        >
          <IconCheck className="h-5 w-5" />
        </button>
      )}
    </article>
  );
}
