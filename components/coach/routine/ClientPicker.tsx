"use client";

import { useId, useMemo, useState } from "react";
import { Avatar } from "@/components/ui";
import type { Profile } from "@/lib/data";
import { normalizeText } from "@/lib/text";

/** Cliente/s como chips + «Agregar otro» con búsqueda. */
export function ClientPicker({
  clients,
  value,
  onChange,
}: {
  clients: Profile[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = value.map((v) => clients.find((c) => c.id === v)).filter(Boolean) as Profile[];
  const options = useMemo(() => {
    const q = normalizeText(query);
    return clients.filter((c) => !value.includes(c.id) && (!q || normalizeText(c.fullName).includes(q))).slice(0, 6);
  }, [clients, value, query]);

  return (
    <div>
      <label htmlFor={id} className="label mb-2 block">
        Cliente/s
      </label>
      <div className="relative rounded-md border border-line bg-surface p-2 focus-within:border-accent">
        <div className="flex flex-wrap items-center gap-2">
          {selected.map((c) => (
            <span key={c.id} className="flex h-10 items-center gap-2 rounded-full bg-surface-2 pl-1 text-small font-semibold">
              <Avatar name={c.fullName} size="xs" />
              {c.fullName}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== c.id))}
                aria-label={`Quitar a ${c.fullName}`}
                className="flex h-10 w-9 items-center justify-center text-muted hover:text-ink"
              >
                ✕
              </button>
            </span>
          ))}
          <input
            id={id}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={selected.length ? "Agregar otro" : "Buscar cliente"}
            role="combobox"
            aria-expanded={open && options.length > 0}
            aria-controls={`${id}-list`}
            autoComplete="off"
            className="h-10 min-w-[8rem] flex-1 bg-transparent px-2 text-body text-ink outline-none placeholder:text-muted"
          />
        </div>
        {open && options.length > 0 && (
          <ul
            id={`${id}-list`}
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-line bg-surface-2"
          >
            {options.map((c) => (
              <li key={c.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange([...value, c.id]);
                    setQuery("");
                  }}
                  className="flex min-h-[48px] w-full items-center gap-3 px-3 text-left hover:bg-line"
                >
                  <Avatar name={c.fullName} size="xs" />
                  <span className="text-body">{c.fullName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-small text-muted">Podés dejarlo vacío y guardarla como plantilla.</p>
    </div>
  );
}
