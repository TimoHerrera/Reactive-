import { R_PATH, R_VIEWBOX } from "@/lib/brand";

/** «R» oficial de REACTIVE. Proporción 301 × 258 (más ancha que alta). */
export function LogoMark({ className = "", title = "Reactive" }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox={`0 0 ${R_VIEWBOX.width} ${R_VIEWBOX.height}`}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      fill="currentColor"
    >
      <path d={R_PATH} />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`text-center ${className}`}>
      <div className="font-sans text-[2rem] font-bold leading-none tracking-[.35em] pl-[.35em]">REACTIVE</div>
      <div className="mt-2 text-[0.625rem] font-semibold tracking-[.22em] pl-[.22em]">REHABILITACIÓN Y ENTRENAMIENTO</div>
    </div>
  );
}
