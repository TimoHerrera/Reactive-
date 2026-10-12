import { cn } from "@/lib/cn";

export function initials(name: string): string {
  return name
    .replace(/\./g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

const sizes = {
  xs: "h-7 w-7 text-[0.625rem]",
  sm: "h-10 w-10 text-caption",
  md: "h-12 w-12 text-small",
  lg: "h-16 w-16 text-[1.25rem]",
};

// Avatar: el de profesional lleva aro azul.
export function Avatar({
  name,
  size = "sm",
  pro,
  className,
}: {
  name: string;
  size?: keyof typeof sizes;
  pro?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "display inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 not-italic text-ink",
        pro ? "border-2 border-accent" : "border border-line",
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function ProCard({ name, role, className }: { name: string; role: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Avatar name={name} size="md" pro />
      <div>
        <p className="text-title-sm text-ink">{name}</p>
        <p className="text-small text-muted">{role}</p>
      </div>
    </div>
  );
}
