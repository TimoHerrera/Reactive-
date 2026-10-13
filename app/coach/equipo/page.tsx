"use client";

import Link from "next/link";
import { InlineLoading } from "@/components/Loading";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { QueryError } from "@/components/QueryError";
import { AccountStatusBadge, AdminOnly, BackHeader } from "@/components/coach/TeamParts";
import { PillButton } from "@/components/ui";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

/** Equipo (solo admin): profes y admins con su estado y cantidad de clientes. */
function Equipo() {
  const team = useQuery(() => data.team.list(), []);
  const list = team.data ?? [];
  const order = { activo: 0, pendiente: 1, desactivado: 2 } as const;
  const sorted = [...list].sort((a, b) => order[a.status] - order[b.status] || a.fullName.localeCompare(b.fullName, "es"));

  return (
    <div className="pb-10">
      <BackHeader href="/coach" label="Panel" title="Equipo">
        <PillButton href="/coach/equipo/nuevo" size="sm">
          + Profe
        </PillButton>
      </BackHeader>
      <div className="px-gutter">
        {team.error && !team.data ? (
          <QueryError onRetry={team.reload} />
        ) : team.loading && !team.data ? (
          <InlineLoading />
        ) : (
          <ul className="space-y-2" aria-label="Profes">
            {sorted.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/coach/equipo/${p.id}`}
                  className="flex min-h-[72px] items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 hover:bg-surface-2"
                >
                  <ProfileAvatar name={p.fullName} avatarPath={p.avatarPath} size="sm" pro={p.status !== "desactivado"} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-title-sm">{p.fullName}</span>
                      {p.role === "admin" && <span className="text-caption font-bold uppercase text-accent">Admin</span>}
                    </span>
                    <span className="block truncate text-small text-muted">
                      {p.clientCount === 1 ? "1 cliente" : `${p.clientCount} clientes`}
                      {p.title ? ` · ${p.title}` : ""}
                    </span>
                  </span>
                  <AccountStatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function EquipoPage() {
  return (
    <AdminOnly>
      <Equipo />
    </AdminOnly>
  );
}
