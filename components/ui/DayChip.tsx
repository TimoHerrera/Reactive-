import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  label: string; // "Día A"
  title?: string; // "Tren inferior"
  active?: boolean;
};

// Chip de día: activo azul, inactivo superficie 2.
export function DayChip({ label, title, active, className, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "flex min-h-[60px] min-w-0 flex-1 flex-col items-center justify-center rounded-md px-2 py-2 transition-colors",
        active ? "bg-accent text-ink" : "border border-line bg-surface-2 text-ink hover:bg-line",
        className,
      )}
      {...rest}
    >
      <span className="display text-[1.375rem]">{label}</span>
      {title && (
        <span className={cn("mt-0.5 w-full text-[0.6875rem] font-medium leading-tight", active ? "text-ink" : "text-muted")}>
          {title}
        </span>
      )}
    </button>
  );
}

// Chip de filtro (Piernas · Core · Movilidad).
export function FilterChip({
  active,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-small font-semibold transition-colors",
        active ? "bg-accent text-ink" : "border border-line bg-surface text-ink hover:bg-surface-2",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
