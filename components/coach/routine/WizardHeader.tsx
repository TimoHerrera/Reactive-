"use client";

import { IconArrowLeft } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const STEPS = ["Datos", "Días y ejercicios", "Asignar y publicar"];

export function WizardHeader({
  step,
  kicker,
  subtitle,
  onBack,
  showSteps = true,
}: {
  step: 1 | 2 | 3;
  kicker: string;
  subtitle?: string;
  onBack: () => void;
  showSteps?: boolean;
}) {
  return (
    <header className="border-b border-line px-gutter pb-3 pt-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[1.5rem] hover:bg-surface-2"
        >
          <IconArrowLeft />
        </button>
        <div className="min-w-0">
          <p className="label">{kicker}</p>
          {subtitle && <p className="truncate text-title-sm">{subtitle}</p>}
        </div>
      </div>
      {showSteps && (
        <ol className="mt-4 grid grid-cols-3 gap-2" aria-label={`Paso ${step} de 3`}>
          {STEPS.map((label, i) => {
            const n = i + 1;
            return (
              <li key={label} aria-current={n === step ? "step" : undefined}>
                <div className={cn("h-1.5 rounded-full", n <= step ? "bg-accent" : "bg-surface-2")} />
                {step === 1 && (
                  <p className={cn("mt-2 text-small", n === step ? "font-bold text-ink" : "text-muted")}>{label}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </header>
  );
}

/** Barra inferior fija de los pasos. */
export function WizardFooter({ children }: { children: React.ReactNode }) {
  return (
    <footer className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-phone -translate-x-1/2 gap-3 border-t border-line bg-bg/95 px-gutter pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      {children}
    </footer>
  );
}
