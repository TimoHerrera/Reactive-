"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { RPE_HELP } from "@/lib/routine/effort";
import { IconCheck, IconPlay } from "./icons";

export type ExerciseChip = { text: string; muted?: boolean };

type Props = {
  number: number;
  name: string;
  /** Si hay video: el nombre es un link (subrayado azul + ▶). Sin video no es tocable. */
  href?: string;
  chips?: ExerciseChip[];
  /** «RPE 8 · RIR 2»: chip con «?» que explica qué es cada cosa. */
  effort?: string | null;
  note?: string;
  done?: boolean;
  onToggle?: () => void;
  /** Se llama al tocar el nombre (antes de navegar al video). */
  onOpen?: () => void;
  /** Solo lectura: muestra el estado sin botón (ej. profe en «Ver como»). */
  readOnly?: boolean;
  /** Resaltado breve al volver del video. */
  highlight?: boolean;
  id?: string;
  className?: string;
};

function EffortChip({ text, done }: { text: string; done?: boolean }) {
  const [open, setOpen] = useState(false);
  const helpId = useId();
  return (
    <li className="contents">
      <span className={cn("inline-flex items-center gap-1 rounded-sm bg-accent/20 py-0.5 pl-2.5 pr-0.5 text-small font-semibold", done ? "text-muted" : "text-ink")}>
        {text}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={helpId}
          aria-label="¿Qué es RPE y RIR?"
          className="-my-2 flex h-11 w-9 items-center justify-center"
        >
          <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-caption font-bold">
            ?
          </span>
        </button>
      </span>
      {open && (
        <span id={helpId} role="note" className="basis-full rounded-sm bg-surface-2 px-3 py-2 text-small text-title">
          {RPE_HELP}
        </span>
      )}
    </li>
  );
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// Card de ejercicio · con video / sin video / hecho
export function ExerciseCard({
  number,
  name,
  href,
  chips = [],
  effort,
  note,
  done,
  onToggle,
  onOpen,
  readOnly,
  highlight,
  id,
  className,
}: Props) {
  const nameEl = href ? (
    <Link
      href={href}
      onClick={onOpen}
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
        "flex scroll-mt-48 gap-3 rounded-lg border p-4 transition-[background-color,border-color,box-shadow] duration-500",
        done ? "border-success/35 bg-surface/60" : "border-line bg-surface",
        highlight && "border-accent ring-2 ring-accent/60",
        className,
      )}
    >
      <span className="display w-8 shrink-0 pt-0.5 text-[1.75rem] text-line" aria-hidden="true">
        {pad2(number)}
      </span>
      <div className="min-w-0 flex-1">
        {nameEl}
        {(chips.length > 0 || effort) && (
          <ul className="mt-3 flex flex-wrap items-center gap-1.5">
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
            {effort && <EffortChip text={effort} done={done} />}
          </ul>
        )}
        {note && (
          <p className={cn("mt-3 text-small", done ? "text-muted" : "text-title")}>
            <strong className="font-bold text-ink">Observaciones:</strong> {note}
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
      {onToggle === undefined && readOnly && (
        <span
          role="img"
          aria-label={done ? "Hecho" : "Sin hacer"}
          className={cn(
            "mt-6 flex h-12 w-12 shrink-0 items-center justify-center self-start rounded-full",
            done ? "bg-success/80 text-bg" : "border-2 border-dashed border-line text-transparent",
          )}
        >
          <IconCheck className="h-5 w-5" />
        </span>
      )}
    </article>
  );
}
