"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ClientAccess } from "@/components/coach/ClientAccess";
import { ClientLog } from "@/components/coach/ClientLog";
import { ClientTabs } from "@/components/coach/ClientTabs";
import { NoAccess } from "@/components/coach/NoAccess";
import { Loading } from "@/components/Loading";
import { Avatar, PillButton, StatusBadge } from "@/components/ui";
import { IconArrowLeft } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { routineProgress, summarizeClient } from "@/lib/coach/clients";
import { CASE_TYPE_LABEL, data, type CaseType } from "@/lib/data";
import { formatDM, formatMonthYear } from "@/lib/dates";
import { useQuery } from "@/lib/hooks";
import { routineStatus } from "@/lib/routine/status";

const CASES = Object.entries(CASE_TYPE_LABEL) as [CaseType, string][];

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const justCreated = params.get("nuevo") === "1";
  const tab = params.get("tab") === "registro" ? "registro" : "ficha";
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const q = useQuery(async () => {
    const [client, routines, notes, staff, counts] = await Promise.all([
      data.profiles.get(id),
      data.routines.listForClient(id),
      data.coachNotes.listForClient(id),
      data.profiles.listStaff(),
      data.routines.itemCounts(),
    ]);
    const sessions = await data.sessions.list({ clientId: id });
    return { client, routines, notes, staff, counts, sessions };
  }, [id]);

  if (q.loading && !q.data) return <Loading />;
  const d = q.data;
  if (!d?.client) {
    return <NoAccess text="Este cliente no existe o lo atiende otro profe." href="/coach/clientes" label="Volver a Clientes" />;
  }
  const c = d.client;
  const summary = summarizeClient(c, d.routines);
  const current = summary.current;
  const progress = current ? routineProgress(current, d.sessions) : null;
  const past = d.routines
    .filter((r) => r.publishedAt && !r.isTemplate && r.id !== current?.id && routineStatus(r) === "vencida")
    .sort((a, b) => (b.endsOn ?? "").localeCompare(a.endsOn ?? ""));
  const authorName = (aid: string | null) => d.staff.find((s) => s.id === aid)?.fullName ?? "Profe";
  const phone = c.phone?.replace(/\D/g, "");
  const since = [c.sport, c.clientSince && `Cliente desde ${formatMonthYear(c.clientSince)}`].filter(Boolean).join(" · ");

  const setCase = async (ct: CaseType) => {
    q.setData((prev) => (prev ? { ...prev, client: { ...prev.client!, caseType: ct } } : prev));
    await data.profiles.update(c.id, { caseType: ct });
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    try {
      const n = await data.coachNotes.add(c.id, note.trim());
      q.setData((prev) => (prev ? { ...prev, notes: [n, ...prev.notes] } : prev));
      setNote("");
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="pb-10">
      <header className="bg-grid px-gutter pb-5 pt-6">
        <Link href="/coach/clientes" className="-ml-1 inline-flex min-h-[44px] items-center gap-2 text-body text-title hover:text-ink">
          <IconArrowLeft className="h-5 w-5" /> Clientes
        </Link>
        <div className="mt-3 flex items-center gap-4">
          <Avatar name={c.fullName} size="lg" className="!h-20 !w-20 border-2 border-ink !text-[1.75rem]" />
          <div className="min-w-0">
            <h1 className="display text-h1">{c.fullName}</h1>
            {c.disabledAt && (
              <span className="mt-1 inline-flex h-6 items-center rounded-full border border-line px-2.5 text-caption font-bold uppercase text-muted">
                Desactivado
              </span>
            )}
            {since && <p className="mt-1 text-small text-muted">{since}</p>}
            {c.coachId && (
              <p className="mt-1 text-small text-muted" data-testid="client-coach">
                Profe: <strong className="font-semibold text-ink">{authorName(c.coachId)}</strong>
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {phone ? (
            <a
              href={`https://wa.me/${phone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center rounded-full border border-line bg-surface font-semibold hover:bg-surface-2"
            >
              WhatsApp
            </a>
          ) : (
            <span className="flex h-12 items-center justify-center rounded-full border border-dashed border-line text-small text-muted">Sin teléfono</span>
          )}
          <Link href={`/coach/clientes/${c.id}/editar`} className="flex h-12 items-center justify-center rounded-full border border-line bg-surface font-semibold hover:bg-surface-2">
            Editar datos
          </Link>
        </div>
      </header>

      <div className="px-gutter">
        <ClientTabs
          clientId={c.id}
          active={tab}
          tabs={[
            { key: "ficha", label: "Ficha" },
            { key: "registro", label: "Registro" },
          ]}
        />
      </div>

      {tab === "registro" ? (
        <div className="px-gutter">
          <ClientLog clientId={c.id} />
        </div>
      ) : (
        <div className="space-y-3 px-gutter">
          {justCreated && (
            <p role="status" className="rounded-md border border-success/60 bg-success/10 px-4 py-3 text-small">
              {data.kind === "supabase"
                ? `Listo: le mandamos a ${c.email} un email para que cree su contraseña.`
                : `Listo. En modo demo entra con ${c.email} y la contraseña de demo.`}
            </p>
          )}

          <section aria-labelledby="caso">
            <p id="caso" className="label mb-2">
              Tipo de caso
            </p>
            <div className="flex flex-wrap gap-2">
              {CASES.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={c.caseType === key}
                  onClick={() => void setCase(key)}
                  className={cn(
                    "h-11 rounded-full px-4 text-small font-semibold",
                    c.caseType === key ? "bg-accent text-ink" : "border border-line text-title hover:bg-surface-2",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-surface p-4">
            <p className="label">Objetivo</p>
            <p className="mt-2 text-[1.1875rem] font-bold leading-snug">{c.goal || <span className="font-normal text-muted">Sin objetivo cargado.</span>}</p>
          </section>

          <section className="rounded-lg border border-line bg-surface p-4" aria-labelledby="obs">
            <div className="flex items-baseline justify-between gap-3">
              <p id="obs" className="label">
                Observaciones del profesional
              </p>
              <span className="text-small text-muted">Solo profes</span>
            </div>
            {d.notes.length === 0 && <p className="mt-2 text-small text-muted">Todavía no hay observaciones.</p>}
            <ul className="mt-2 space-y-4">
              {d.notes.map((n) => (
                <li key={n.id}>
                  <p className="whitespace-pre-line text-body">{n.body}</p>
                  <p className="mt-1 text-small text-muted">
                    {authorName(n.authorId)} · {formatDM(n.createdAt.slice(0, 10))}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-line pt-3">
              <label htmlFor="nota" className="sr-only">
                Nueva observación
              </label>
              <textarea
                id="nota"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Sumar una observación (el cliente no la ve)"
                className="w-full rounded-md border border-line bg-bg px-3 py-2 text-body text-ink outline-none placeholder:text-muted/70 focus:border-accent"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => void addNote()}
                  disabled={!note.trim() || savingNote}
                  className="h-11 rounded-full bg-ink px-5 text-small font-bold text-bg disabled:opacity-40"
                >
                  {savingNote ? "Guardando…" : "Agregar"}
                </button>
              </div>
            </div>
          </section>

          {current ? (
            <section className="rounded-lg border-2 border-accent bg-surface p-4" aria-labelledby="actual">
              <div className="flex items-start justify-between gap-3">
                <p id="actual" className="label">
                  Rutina actual
                </p>
                <StatusBadge status={summary.filter === "por-vencer" ? "por-vencer" : "activa"} />
              </div>
              <p className="display mt-2 text-h1">{current.name}</p>
              <p className="mt-1 text-small text-muted">
                {formatDM(current.startsOn)} → {formatDM(current.endsOn)} · {current.daysPerWeek} días · {d.counts[current.id] ?? 0} ejercicios
              </p>
              {progress && (
                <div className="mt-4">
                  <div className="flex justify-between text-small">
                    <span className="text-title">Sesiones</span>
                    <span className="font-semibold">
                      {progress.done} de {progress.planned}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
                    role="progressbar"
                    aria-label="Sesiones completadas"
                    aria-valuemin={0}
                    aria-valuemax={progress.planned}
                    aria-valuenow={progress.done}
                  >
                    <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, (progress.done / progress.planned) * 100)}%` }} />
                  </div>
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <PillButton href={`/coach/rutinas/${current.id}/editar`} variant="outline" size="sm">
                  Editar
                </PillButton>
                <PillButton href={`/coach/rutinas/nueva?cliente=${c.id}`} size="sm" arrow>
                  Asignar rutina
                </PillButton>
              </div>
              <Link href={`/app?como=${c.id}`} className="mt-3 flex min-h-[44px] items-center justify-center text-small font-semibold underline underline-offset-4">
                Ver como {c.fullName.split(" ")[0]}
              </Link>
            </section>
          ) : (
            <section className="rounded-lg border-2 border-dashed border-line p-5 text-center">
              <p className="text-title-sm">Sin rutina vigente</p>
              <p className="mt-1 text-small text-muted">Armale una a medida o partí de una plantilla.</p>
              <PillButton href={`/coach/rutinas/nueva?cliente=${c.id}`} arrow className="mt-4">
                Asignar rutina
              </PillButton>
            </section>
          )}

          {past.length > 0 && (
            <section className="pt-3">
              <h2 className="display text-h2 text-title">Rutinas anteriores</h2>
              <ul className="mt-2 rounded-lg border border-line bg-surface px-4">
                {past.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
                    <span className="min-w-0">
                      <span className="block truncate text-title-sm">{r.name}</span>
                      <span className="block text-small text-muted">
                        {formatDM(r.startsOn)} → {formatDM(r.endsOn)} · {r.daysPerWeek} días
                      </span>
                    </span>
                    <Link href={`/coach/rutinas/${r.id}/duplicar?cliente=${c.id}`} className="flex h-11 shrink-0 items-center text-small font-semibold underline underline-offset-4">
                      Reusar
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ClientAccess client={c} onChanged={(p) => q.setData((prev) => (prev ? { ...prev, client: p } : prev))} />
        </div>
      )}
    </div>
  );
}
