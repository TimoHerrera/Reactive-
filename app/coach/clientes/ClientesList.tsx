"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AccessRequestCard } from "@/components/coach/AccessRequestCard";
import { CoachFilterChips, useCoachFilter } from "@/components/coach/CoachFilter";
import { InlineLoading } from "@/components/Loading";
import { QueryError } from "@/components/QueryError";
import { Avatar, FilterChip, Input, PillButton, StatusBadge } from "@/components/ui";
import { matchesClient, sortClients, summarizeClient, type ClientSummary } from "@/lib/coach/clients";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/hooks";
import type { ClientRoutineFilter } from "@/lib/routine/status";

type Filter = "todos" | ClientRoutineFilter | "solicitudes" | "desactivados";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "activa", label: "Activa" },
  { key: "por-vencer", label: "Por vencer" },
  { key: "sin-rutina", label: "Sin rutina" },
  { key: "solicitudes", label: "Solicitudes" },
  { key: "desactivados", label: "Desactivados" },
];

function Badge({ s }: { s: ClientSummary }) {
  if (s.client.disabledAt) return <StatusBadge status="vencida">Desactivado</StatusBadge>;
  return <StatusBadge status={s.filter} />;
}

export function ClientesList() {
  const router = useRouter();
  const params = useSearchParams();
  const filter = (params.get("filtro") as Filter) || "todos";
  const [query, setQuery] = useState("");
  const coachFilter = useCoachFilter();

  const q = useQuery(async () => {
    const [clients, routines] = await Promise.all([data.profiles.listClients(), data.routines.list()]);
    return sortClients(clients.map((c) => summarizeClient(c, routines.filter((r) => r.clientId === c.id))));
  }, []);

  // Solicitudes: sin refresco automático, así la tarjeta aprobada queda visible (con el link de activación).
  const requests = useQuery(async () => {
    const [list, staff] = await Promise.all([data.accessRequests.list("pending"), data.profiles.listStaff()]);
    return { list, staff };
  }, [], { live: false });
  const [handled, setHandled] = useState<string[]>([]);

  const scoped = useMemo(
    () => (q.data ?? []).filter((s) => !coachFilter.coachId || s.client.coachId === coachFilter.coachId),
    [q.data, coachFilter.coachId],
  );
  // Desactivados: fuera de las listas (y de los contadores), salvo en su filtro.
  const all = useMemo(() => scoped.filter((s) => !s.client.disabledAt), [scoped]);
  const disabled = useMemo(() => scoped.filter((s) => s.client.disabledAt), [scoped]);
  const visibleRequests = (requests.data?.list ?? []).filter(
    (r) => !coachFilter.coachId || r.requestedCoachId === coachFilter.coachId,
  );
  const staffName = (id: string | null) => (id ? (requests.data?.staff.find((p) => p.id === id)?.fullName ?? null) : null);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      todos: all.length,
      activa: 0,
      "por-vencer": 0,
      "sin-rutina": 0,
      solicitudes: 0,
      desactivados: disabled.length,
    };
    for (const s of all) c[s.filter]++;
    return c;
  }, [all, disabled]);
  counts.solicitudes = visibleRequests.filter((r) => !handled.includes(r.id)).length;
  const list =
    filter === "desactivados"
      ? disabled.filter((s) => matchesClient(s, query))
      : all.filter((s) => (filter === "todos" || s.filter === filter) && matchesClient(s, query));

  return (
    <div className="pb-6">
      <header className="flex items-center justify-between gap-3 px-gutter pb-4 pt-12">
        <h1 className="display text-display-xl text-title">Clientes</h1>
        <PillButton href="/coach/clientes/nuevo" size="md" className="shrink-0">
          + Cliente
        </PillButton>
      </header>
      <div className="px-gutter">
        <Input
          search
          placeholder="Buscar por nombre u objetivo"
          aria-label="Buscar cliente por nombre, objetivo o caso"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <CoachFilterChips filter={coachFilter} className="mt-4" />
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-gutter" role="group" aria-label="Filtrar por rutina">
        {FILTERS.map((f) => (
          <FilterChip
            key={f.key}
            active={filter === f.key}
            onClick={() => router.replace(f.key === "todos" ? "/coach/clientes" : `/coach/clientes?filtro=${f.key}`, { scroll: false })}
          >
            {f.label} <span className={filter === f.key ? "text-ink/80" : "text-muted"}>{q.data ? counts[f.key] : ""}</span>
          </FilterChip>
        ))}
      </div>

      <div className="px-gutter">
        {filter === "solicitudes" ? (
          requests.loading && !requests.data ? (
            <InlineLoading />
          ) : visibleRequests.length === 0 ? (
            <p className="mt-10 text-center text-muted">No hay solicitudes de acceso pendientes.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {visibleRequests.map((r) => (
                <AccessRequestCard
                  key={r.id}
                  request={r}
                  coachName={r.requestedCoachId ? (staffName(r.requestedCoachId) ?? "Profe") : null}
                  assignable={coachFilter.isAdmin ? coachFilter.coaches : undefined}
                  onChanged={() => {
                    setHandled((h) => [...h, r.id]);
                    void q.reload();
                  }}
                />
              ))}
            </ul>
          )
        ) : !q.data ? (
          q.error ? (
            <div className="mt-6">
              <QueryError what="los clientes" onRetry={() => void q.reload()} />
            </div>
          ) : (
            <InlineLoading />
          )
        ) : list.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-muted">
              {all.length === 0 ? "Todavía no cargaste clientes." : query ? `Nadie coincide con «${query}».` : "No hay clientes en este filtro."}
            </p>
            {all.length === 0 && (
              <PillButton href="/coach/clientes/nuevo" variant="inverse" className="mt-6" arrow>
                Sumar el primero
              </PillButton>
            )}
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {list.map((s) => (
              <li key={s.client.id}>
                <Link
                  href={`/coach/clientes/${s.client.id}`}
                  className="flex min-h-[72px] items-center gap-3 rounded-lg border border-line bg-surface px-3 py-3 hover:bg-surface-2"
                >
                  <Avatar name={s.client.fullName} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-title-sm">{s.client.fullName}</span>
                    <span className="block truncate text-small text-muted">
                      {coachFilter.isAdmin && !coachFilter.coachId && staffName(s.client.coachId) ? `${staffName(s.client.coachId)} · ` : ""}
                      {s.subtitle}
                    </span>
                  </span>
                  <Badge s={s} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
