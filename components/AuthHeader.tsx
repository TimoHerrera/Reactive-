import type { ReactNode } from "react";
import { LogoMark } from "@/components/ui";

export function AuthHeader({ children }: { children: ReactNode }) {
  return (
    <header className="bg-grid border-b border-line px-gutter pb-8 pt-12">
      <div className="flex items-center gap-3">
        <LogoMark className="h-9 w-8 text-ink" />
        <div>
          <p className="text-[1.0625rem] font-bold leading-none tracking-[.3em]">REACTIVE</p>
          <p className="mt-1 text-[0.5rem] font-semibold tracking-[.18em] text-title">REHABILITACIÓN Y ENTRENAMIENTO</p>
        </div>
      </div>
      <h1 className="display mt-10 text-display-xl">{children}</h1>
    </header>
  );
}
