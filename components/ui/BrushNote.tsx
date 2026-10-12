import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Nota con pincel: SVG blanco + texto negro.
export function BrushNote({
  title = "Nota del profe",
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative px-9 py-6 text-bg", className)}>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 300 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          fill="#FFFFFF"
          d="M14 9 C60 4 120 7 170 3 C215 0 255 5 288 8 L282 20 L296 31 L285 44 L298 57 L284 69 L295 82 L280 92 C230 97 180 93 130 97 C85 100 45 95 12 93 L18 81 L4 69 L16 57 L2 44 L15 32 L3 20 Z"
        />
      </svg>
      <div className="relative">
        <p className="display text-[1.25rem]">{title}</p>
        <div className="mt-1 text-body font-medium leading-snug">{children}</div>
      </div>
    </div>
  );
}
