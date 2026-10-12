import { cn } from "@/lib/cn";
import { LogoMark } from "./Logo";

export type BadgeStatus =
  | "activa"
  | "por-vencer"
  | "vencida"
  | "sin-rutina"
  | "con-video"
  | "sin-video"
  | "video-yt"
  | "revisar"
  | "no-encontrado"
  | "plantilla"
  | "no-hagas-esto"
  | "solo-profes";

const styles: Record<BadgeStatus, { className: string; label: string }> = {
  activa: { className: "bg-success/15 text-success", label: "Activa" },
  "por-vencer": { className: "bg-warning/15 text-warning", label: "Por vencer" },
  vencida: { className: "border border-line text-muted", label: "Vencida" },
  "sin-rutina": { className: "border border-line text-title", label: "Sin rutina" },
  "con-video": { className: "bg-success/15 text-success", label: "✓ con video" },
  "sin-video": { className: "bg-warning/15 text-warning", label: "SIN VIDEO" },
  "video-yt": { className: "bg-surface-2 text-ink", label: "▶ + YT" },
  revisar: { className: "bg-warning/15 text-warning", label: "! Revisar" },
  "no-encontrado": { className: "bg-danger/15 text-danger-ink", label: "✕ No encontrado" },
  plantilla: { className: "bg-ink text-bg", label: "PLANTILLA" },
  "no-hagas-esto": { className: "display bg-danger px-2 text-[0.9375rem] text-ink", label: "No hagas esto" },
  "solo-profes": { className: "border border-line text-muted", label: "Solo profes" },
};

export function StatusBadge({
  status,
  children,
  className,
}: {
  status: BadgeStatus;
  children?: React.ReactNode;
  className?: string;
}) {
  const s = styles[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap px-2.5 text-caption font-semibold",
        status === "no-hagas-esto" ? "rounded-sm" : "rounded-full",
        s.className,
        className,
      )}
    >
      {status === "plantilla" && <LogoMark className="h-3 w-3" title="" />}
      {children ?? s.label}
    </span>
  );
}
