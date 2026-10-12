"use client";

import Link from "next/link";
import { CoachMenu } from "@/components/coach/CoachMenu";
import { InlineLoading } from "@/components/Loading";
import { useSession } from "@/components/SessionProvider";
import { Avatar, LogoMark, PillButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { buildActivity, greeting, type ActivityKind } from "@/lib/coach/activity";
import { data, hasVideo, type RoutineTree } from "@/lib/data";
import { useQuery } from "@/lib/hooks";
import { clientRoutineFilter, routineStatus } from "@/lib/routine/status";

const DOT: Record<ActivityKind, string> = {
  completada: "bg-success",
  parcial: "bg-accent",
  vence: "bg-warning",
  vistas: "bg-muted",
};

function SheetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

export default function PanelPage() {
  const { user } = useSession();
  const q = useQuery(async () => {
    const since = new Date(Date.now() - 8 * 86_400_000).toISOString();
    const [clients, routines, exercises, sessions, views, requests] = await Promise.all([
      data.profiles.listClients(),
      data.routines.list(),
      data.exercises.list(),
      data.sessions.list({ since }),
      data.views.list({ since }),
      data.accessRequests.list("pending"),
    ]);
    const checks = await data.sessions.listChecks(sessions.map((s) => s.id));
    const ids = [...new Set(sessions.map((s) => s.routineId))];
    const trees = new Map<string, RoutineTree>();
    for (const t of await Promise.all(ids.map((id) => data.routines.getTree(id)))) if (t) trees.set(t.id, t);

    const byClient = (id: string) => routines.filter((r) => r.clientId === id);
    return {
      activos: clients.filter((c) => clientRoutineFilter(byClient(c.id)) !== "sin-rutina").length,
      vencen: routines.filter((r) => r.clientId && routineStatus(r) === "por-vencer").length,
      sinVideo: exercises.filter((e) => !hasVideo(e)).length,
      solicitudes: requests.length,
      ultimaSolicitud: requests[0]?.fullName ?? null,
      activity: buildActivity({
        clients,
        routines,
        trees,
        sessions,
        checks,
        views,
        exerciseNames: new Map(exercises.map((e) => [e.id, e.name])),
      }),
    };
  }, []);

  const firstName = user?.fullName.split(" ")[0] ?? "";
  const metrics = [
    { n: q.data?.activos, label: "Clientes activos", href: "/coach/clientes?filtro=activa", warn: false },
    { n: q.data?.vencen, label: "Rutinas vencen esta semana", href: "/coach/clientes?filtro=por-vencer", warn: true },
    { n: q.data?.sinVideo, label: "Ejercicios sin video", href: "/coach/ejercicios?sin-video=1", warn: false },
  ];

  return (
    <div className="pb-8">
      <header className="bg-grid px-gutter pb-5 pt-8">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <LogoMark className="h-7 w-6 text-ink" />
            <span className="label">Modo profe</span>
          </span>
          <CoachMenu />
        </div>
        <h1 className="display mt-4 text-display-xl text-title">Panel</h1>
        <p className="mt-1 text-body text-title">{greeting(firstName)} Esto es lo que pasa hoy.</p>
      </header>

      <div className="space-y-3 px-gutter">
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((m) => (
            <Link
              key={m.label}
              href={m.href}
              className={cn(
                "flex min-h-[112px] flex-col rounded-lg border bg-surface p-3 hover:bg-surface-2",
                m.warn && (m.n ?? 0) > 0 ? "border-warning" : "border-line",
              )}
            >
              <span className={cn("display text-display-section leading-none", m.warn && (m.n ?? 0) > 0 && "text-warning")}>
                {m.n ?? "–"}
              </span>
              <span className="mt-auto pt-2 text-caption leading-snug text-title">{m.label}</span>
            </Link>
          ))}
        </div>

        <Link
          href="/coach/clientes?filtro=solicitudes"
          className={cn(
            "flex min-h-[64px] items-center justify-between gap-3 rounded-lg border px-4 py-3",
            (q.data?.solicitudes ?? 0) > 0 ? "border-warning bg-warning/10 hover:bg-warning/15" : "border-line bg-surface hover:bg-surface-2",
          )}
        >
          <span className="min-w-0">
            <span className="block text-title-sm">Solicitudes de acceso ({q.data?.solicitudes ?? "–"})</span>
            <span className="block truncate text-small text-muted">
              {(q.data?.solicitudes ?? 0) > 0
                ? `${q.data!.ultimaSolicitud}${q.data!.solicitudes > 1 ? ` y ${q.data!.solicitudes - 1} más` : ""} quiere${q.data!.solicitudes > 1 ? "n" : ""} entrar`
                : "Nadie esperando por ahora"}
            </span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-[1.25rem]">→</span>
        </Link>

        <PillButton href="/coach/rutinas/nueva" arrow block>
          + Nueva rutina
        </PillButton>
        <div className="grid grid-cols-2 gap-2">
          <PillButton href="/coach/rutinas/nueva/importar" variant="inverse" size="md" className="!text-[1.125rem]">
            <span className="inline-flex items-center gap-2">
              <SheetIcon /> Importar Excel
            </span>
          </PillButton>
          <PillButton href="/coach/ejercicios/nuevo" variant="outline" size="md" className="!text-[1.125rem]">
            + Ejercicio
          </PillButton>
        </div>

        <section className="pt-4" aria-labelledby="actividad">
          <div className="flex items-baseline justify-between">
            <h2 id="actividad" className="display text-h2 text-title">
              Actividad reciente
            </h2>
            <span className="text-small text-muted">Últimos días</span>
          </div>
          {q.loading && !q.data ? (
            <InlineLoading />
          ) : q.data?.activity.length ? (
            <ul className="mt-3 overflow-hidden rounded-lg border border-line bg-surface">
              {q.data.activity.map((a) => (
                <li key={a.key} className="border-b border-line last:border-0">
                  <Link href={`/coach/clientes/${a.clientId}`} className="flex min-h-[64px] items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <Avatar name={a.clientName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body">
                        {a.parts.map((p, i) => (p.strong ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>))}
                      </span>
                      <span className="block truncate text-small text-muted">{a.sub}</span>
                    </span>
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT[a.kind])} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-line p-5 text-center text-small text-muted">
              Todavía no hay actividad. Cuando tus clientes entrenen o vean videos, aparece acá.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
