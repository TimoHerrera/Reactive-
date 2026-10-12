"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { normalizeText } from "@/lib/text";

/** Alias como chips: Enter o coma agrega, ✕ quita. */
export function AliasInput({
  value,
  onChange,
  name,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /** Nombre del ejercicio (no se acepta como alias). */
  name: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = (raw: string) => {
    const alias = raw.trim().replace(/,$/, "").trim();
    if (!alias) return;
    const key = normalizeText(alias);
    if (key === normalizeText(name)) return setError("Ese es el nombre del ejercicio.");
    if (value.some((a) => normalizeText(a) === key)) return setError("Ese alias ya está.");
    onChange([...value, alias]);
    setDraft("");
    setError(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      <label htmlFor={id} className="label mb-2 block">
        Sinónimos / alias
      </label>
      <div className="rounded-md border border-line bg-surface p-2 focus-within:border-accent">
        {value.length > 0 && (
          <ul className="flex flex-wrap gap-2 p-1">
            {value.map((a) => (
              <li key={a} className="flex h-11 items-center gap-1 rounded-sm bg-surface-2 pl-3 text-small font-semibold">
                {a}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x !== a))}
                  aria-label={`Quitar alias ${a}`}
                  className="flex h-11 w-11 items-center justify-center text-muted hover:text-ink"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder="+ alias"
          enterKeyHint="done"
          className="h-11 w-full bg-transparent px-2 text-body text-ink outline-none placeholder:text-muted"
        />
      </div>
      {error ? (
        <p className="mt-2 text-small text-danger-ink">✕ {error}</p>
      ) : (
        <p className="mt-2 text-small text-muted">Si en el Excel escribís cualquiera de estos, lo vinculamos solo.</p>
      )}
    </div>
  );
}
