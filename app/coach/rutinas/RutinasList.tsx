"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { InlineLoading } from "@/components/Loading";
import { Avatar, PillButton, StatusBadge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { data, type Profile, type Routine } from "@/lib/data";
import { formatDM } from "@/lib/dates";
import { useQuery } from "@/lib/hooks";
import { routineStatus, type RoutineStatus } from "@/lib/routine/status";

type Tab = "activas" | "plantillas" | "vencidas";
const TABS: { key: Tab; label: string }[] = [
  { key: "activas", label: "Activas" },
  { key: "plantillas", label: "Plantillas" },
  { key: "vencidas", label: "Vencidas" },
];

function tabOf(s: RoutineStatus): Tab | null {
  if (s === "plantilla") return "plantillas";
  if (s === "vencida") return "vencidas";
  if (s === "activa" || s === "por-vencer" || s === "programada") return "activas";
  return null; // borradores: no se listan
}

function Badge({ status }: { status: RoutineStatus }) {
  if (status === "activa") return <StatusBadge status="activa" />;
  if (status === "por-vencer") return <StatusBadge status="por-vencer">Vence pronto</StatusBadge>;
  if (status === "programada") return <StatusBadge status="sin-rutina">Programada</StatusBadge>;
  if (status === "plantilla") return <StatusBadge status="plantilla" />;
  return <StatusBadge status="vencida" />;
}

function IconButton({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} aria-label={label} title={label} className="flex h-11 w-11 items-center justify-center rounded-full text-title hover:bg-surface-2 hover:text-ink">
      {children}
    </Link>
  );
}

const DuplicateIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
);
const EditIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
    <path d="M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4" />
  </svg>
);

function RoutineCard({ r, status, count, client }: { r: Routine; status: RoutineStatus; count: number; client: Profile | undefined }) {
  const meta = [
    r.startsOn && r.endsOn ? `${formatDM(r.startsOn)} → ${formatDM(r.endsOn)}` : null,
    `${r.daysPerWeek} ${r.daysPerWeek === 1 ? "día" : "días"}`,
    `${count} ejercicios`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="display text-h2">{r.name}</h2>
        <Badge status={status} />
      </div>
      <p className="mt-1 text-small text-muted">{meta}</p>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
        {client ? (
          <span className="flex min-w-0 items-center gap-2 text-body text-title">
            <Avatar name={client.fullName} size="xs" />
            <span className="truncate">{client.fullName}</span>
          </span>
        ) : status === "plantilla" ? (
          <Link href={`/coach/rutinas/${r.id}/usar`} className="flex h-11 items-center rounded-full bg-ink px-4 text-small font-bold text-bg">
            Usar plantilla
          </Link>
        ) : (
          <span />
        )}
        <span className="flex shrink-0">
          <IconButton href={`/coach/rutinas/${r.id}/duplicar`} label={`Duplicar ${r.name}`}>
            <DuplicateIcon />
          </IconButton>
          <IconButton href={`/coach/rutinas/${r.id}/editar`} label={`Editar ${r.name}`}>
            <EditIcon />
          </IconButton>
        </span>
      </div>
    </li>
  );
}

export function RutinasList() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get("tab") as Tab) || "activas";
  const q = useQuery(async () => {
    const [routines, counts, clients] = await Promise.all([data.routines.list(), data.routines.itemCounts(), data.profiles.listClients()]);
    return { routines, counts, clients };
  }, []);

  const grouped = useMemo(() => {
    const g: Record<Tab, { r: Routine; status: RoutineStatus }[]> = { activas: [], plantillas: [], vencidas: [] };
    for (const r of q.data?.routines ?? []) {
      const status = routineStatus(r);
      const t = tabOf(status);
      if (t) g[t].push({ r, status });
    }
    g.activas.sort((a, b) => (a.r.endsOn ?? "").localeCompare(b.r.endsOn ?? "")); // las que vencen antes, arriba
    g.vencidas.sort((a, b) => (b.r.endsOn ?? "").localeCompare(a.r.endsOn ?? ""));
    g.plantillas.sort((a, b) => a.r.name.localeCompare(b.r.name, "es"));
    return g;
  }, [q.data]);

  const clientById = useMemo(() => new Map((q.data?.clients ?? []).map((c) => [c.id, c])), [q.data]);

  return (
    <div className="pb-6">
      <header className="flex items-center justify-between gap-3 px-gutter pb-4 pt-12">
        <h1 className="display text-display-xl text-title">Rutinas</h1>
        <PillButton href="/coach/rutinas/nueva" size="md" className="shrink-0">
          + Nueva
        </PillButton>
      </header>

      <div className="px-gutter">
        <div role="tablist" aria-label="Rutinas" className="grid grid-cols-3 gap-1 rounded-md border border-line bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => router.replace(`/coach/rutinas?tab=${t.key}`, { scroll: false })}
              className={cn(
                "h-11 rounded-sm text-small font-semibold transition-colors",
                tab === t.key ? "bg-ink text-bg" : "text-title hover:bg-surface-2",
              )}
            >
              {t.label} {q.data ? grouped[t.key].length : ""}
            </button>
          ))}
        </div>

        {q.loading && !q.data ? (
          <InlineLoading />
        ) : grouped[tab].length === 0 ? (
          <p className="mt-10 text-center text-muted">
            {tab === "plantillas"
              ? "Todavía no hay plantillas. Guardá una desde la carga de rutina."
              : tab === "activas"
                ? "No hay rutinas activas."
                : "No hay rutinas vencidas."}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {grouped[tab].map(({ r, status }) => (
              <RoutineCard
                key={r.id}
                r={r}
                status={status}
                count={q.data!.counts[r.id] ?? 0}
                client={r.clientId ? clientById.get(r.clientId) : undefined}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
