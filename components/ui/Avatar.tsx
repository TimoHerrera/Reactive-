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

// Avatar: el de profesional lleva aro azul. Con foto (`src`) la muestra; si no, las iniciales.
export function Avatar({
  name,
  size = "sm",
  pro,
  src,
  className,
}: {
  name: string;
  size?: keyof typeof sizes;
  pro?: boolean;
  src?: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "display inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 not-italic text-ink",
        pro ? "border-2 border-accent" : "border border-line",
        sizes[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL firmada / blob local, no pasa por next/image
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function ProCard({ name, role, src, className }: { name: string; role: string; src?: string | null; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Avatar name={name} size="md" pro src={src} />
      <div>
        <p className="text-title-sm text-ink">{name}</p>
        <p className="text-small text-muted">{role}</p>
      </div>
    </div>
  );
}
