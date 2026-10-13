"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useSession } from "@/components/SessionProvider";
import { PillButton } from "@/components/ui";
import { IconArrowLeft } from "@/components/ui/icons";
import type { AccountStatus } from "@/lib/data/types";
import { cn } from "@/lib/cn";

export function BackHeader({ href, label, title, children }: { href: string; label: string; title: string; children?: ReactNode }) {
  return (
    <header className="px-gutter pb-4 pt-6">
      <Link href={href} className="-ml-1 inline-flex min-h-[44px] items-center gap-2 text-body text-title hover:text-ink">
        <IconArrowLeft className="h-5 w-5" /> {label}
      </Link>
      <div className="mt-2 flex items-end justify-between gap-3">
        <h1 className="display text-display-xl text-title">{title}</h1>
        {children}
      </div>
    </header>
  );
}

const STATUS: Record<AccountStatus, { label: string; className: string }> = {
  activo: { label: "Activo", className: "bg-success/15 text-success" },
  pendiente: { label: "Invitación pendiente", className: "bg-warning/15 text-warning" },
  desactivado: { label: "Desactivado", className: "border border-line text-muted" },
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const s = STATUS[status];
  return <span className={cn("inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-caption font-bold uppercase", s.className)}>{s.label}</span>;
}

/** Solo admin. El middleware ya redirige; esto cubre la navegación del lado del cliente. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useSession();
  if (user && user.role !== "admin") {
    return (
      <div className="px-gutter pt-16 text-center">
        <p className="display text-h1">Solo para admins</p>
        <p className="mt-3 text-muted">El equipo lo gestiona un admin de Reactive.</p>
        <PillButton href="/coach" variant="inverse" className="mt-8">
          Volver al panel
        </PillButton>
      </div>
    );
  }
  return <>{children}</>;
}

/** Link o código para pasarle a la persona invitada (se muestra una sola vez). */
export function ShareBox({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-accent bg-surface p-4" role="status">
      <p className="label">{label}</p>
      <p data-testid={testId} className="mt-2 break-all font-mono text-body text-ink">
        {value}
      </p>
      {hint && <p className="mt-2 text-small text-muted">{hint}</p>}
      <PillButton
        type="button"
        size="sm"
        variant="inverse"
        className="mt-3"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => setCopied(true));
        }}
      >
        {copied ? "✓ Copiado" : "Copiar"}
      </PillButton>
    </div>
  );
}
