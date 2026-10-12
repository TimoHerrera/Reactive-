import { useId } from "react";

// Aproximación de la «R» del diseño (bloque con contraforma y corte diagonal).
// Reemplazar por el SVG oficial cuando esté disponible.
export function LogoMark({ className = "", title = "Reactive" }: { className?: string; title?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 110" className={className} role="img" aria-label={title} fill="currentColor">
      <defs>
        <mask id={id}>
          <rect width="100" height="110" fill="white" />
          <polygon points="-4,88 104,56 104,65 -4,97" fill="black" />
        </mask>
      </defs>
      <path
        mask={`url(#${id})`}
        fillRule="evenodd"
        d="M0 0H62C84 0 96 13 96 33C96 48 88 58 75 62L100 110H69L48 67H29V110H0Z M29 23V45H59C67 45 70 40 70 34C70 28 67 23 59 23Z"
      />
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
