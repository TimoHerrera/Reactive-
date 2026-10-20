"use client";

/** − N + con límites. */
export function Stepper({ value, onChange, range, label, disabled }: {
  value: number;
  onChange: (n: number) => void;
  range: readonly [number, number];
  label: string;
  disabled?: boolean;
}) {
  const [min, max] = range;
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const btn = "flex h-11 w-11 items-center justify-center rounded-full border border-line text-[1.25rem] font-bold hover:bg-surface-2 disabled:opacity-40";
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" aria-label={`Menos ${label}`} disabled={disabled || value <= min} onClick={() => onChange(clamp(value - 1))} className={btn}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => e.target.value !== "" && onChange(clamp(Number(e.target.value)))}
        className="h-11 w-16 rounded-md border border-line bg-bg text-center text-body font-bold tabular-nums text-ink outline-none focus:border-accent disabled:opacity-40 [color-scheme:dark]"
      />
      <button type="button" aria-label={`Más ${label}`} disabled={disabled || value >= max} onClick={() => onChange(clamp(value + 1))} className={btn}>
        +
      </button>
    </span>
  );
}
