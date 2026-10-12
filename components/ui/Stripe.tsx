import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Franja destacada: ancho total, 0 o −3°.
export function Stripe({
  children,
  tilt = false,
  className,
}: {
  children: ReactNode;
  tilt?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "display bg-ink px-4 py-2.5 text-center text-[1.625rem] text-bg",
        tilt && "-rotate-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
