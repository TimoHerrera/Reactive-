"use client";

import type { ReactNode } from "react";
import { useClientRoutine } from "@/components/client/useClientRoutine";
import { PickClientNotice, ViewAsBanner } from "@/components/client/ViewAsBanner";
import { Loading } from "@/components/Loading";
import { useSession } from "@/components/SessionProvider";
import { Avatar, PillButton, Stripe } from "@/components/ui";
import { formatDM, formatMonthYear } from "@/lib/dates";
import { SERVICES, whatsappLink } from "@/lib/content";
import { routineStatus } from "@/lib/routine/status";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-4 border-b border-line py-3 last:border-0">
      <span className="text-body text-muted">{label}</span>
      <span className="min-w-0 text-right text-body">{children}</span>
    </div>
  );
}

export function PerfilView() {
  const r = useClientRoutine();
  const { signOut } = useSession();

  if (r.viewingAs && !r.clientId) return <PickClientNotice />;
  if (r.loading) return <Loading />;
  const client = r.data?.client;
  if (!client) return <Loading />;
  const coach = r.data?.coach ?? null;

  const past = (r.data?.routines ?? [])
    .filter((x) => x.publishedAt && routineStatus(x) === "vencida")
    .sort((a, b) => (b.endsOn ?? "").localeCompare(a.endsOn ?? ""));

  const since = [client.clientSince && `Cliente desde ${formatMonthYear(client.clientSince)}`, client.sport].filter(Boolean).join(" · ");
  const wa = whatsappLink(`¡Hola! Soy ${client.fullName}, te escribo desde la app de Reactive.`);

  return (
    <div className="pb-10">
      {r.viewingAs && <ViewAsBanner client={client} />}

      <header className="bg-grid flex items-center gap-4 px-gutter pb-8 pt-12">
        <Avatar name={client.fullName} size="lg" className="!h-20 !w-20 border-2 border-ink !text-[1.75rem]" />
        <div className="min-w-0">
          <h1 className="display text-h1">{client.fullName}</h1>
          {since && <p className="mt-1 text-small text-muted">{since}</p>}
        </div>
      </header>

      <Stripe className="whitespace-nowrap px-2 text-[min(5.3vw,1.375rem)]">¡Tu recuperación en manos expertas!</Stripe>

      <div className="space-y-3 px-gutter pt-6">
        {client.goal && (
          <section className="rounded-lg border border-line bg-surface p-4">
            <p className="label">Tu objetivo</p>
            <p className="mt-2 text-[1.1875rem] font-bold leading-snug">{client.goal}</p>
          </section>
        )}

        <section className="rounded-lg border border-line bg-surface px-4" aria-label="Tus datos">
          <Row label="Email">{client.email}</Row>
          <Row label="Teléfono">{client.phone ?? "—"}</Row>
          <div id="profe" className="scroll-mt-24">
            <Row label="Tu profe">
              {coach ? (
                <span className="inline-flex items-center gap-2">
                  <Avatar name={coach.fullName} size="xs" pro />
                  {coach.fullName}
                  {coach.title && ` · ${coach.title.split(" ")[0]}`}
                </span>
              ) : (
                "—"
              )}
            </Row>
          </div>
        </section>

        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 items-center justify-center gap-3 rounded-full bg-[#25D366] text-body font-bold text-bg"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.1.3.6 1.1 1.4 1.8 1 .9 1.8 1.1 2.1 1.3.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.8-.1 1.5Z" />
            </svg>
            Escribile a Reactive por WhatsApp
          </a>
        )}

        {past.length > 0 && (
          <section className="pt-5">
            <h2 className="display text-h2 text-title">Rutinas anteriores</h2>
            <ul className="mt-3 rounded-lg border border-line bg-surface px-4">
              {past.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 border-b border-line py-4 last:border-0">
                  <div className="min-w-0">
                    <p className="text-title-sm">{x.name}</p>
                    <p className="text-small text-muted">
                      {formatDM(x.startsOn)} → {formatDM(x.endsOn)} · {x.daysPerWeek} días
                    </p>
                  </div>
                  <span className="shrink-0 text-small font-bold text-success">Completada</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="pt-5">
          <h2 className="display text-h2 text-title">Servicios de Reactive</h2>
          <ul className="mt-3 space-y-3">
            {SERVICES.map((s) => (
              <li key={s.title} className="rounded-lg border border-line bg-surface p-4">
                <p className="display text-[1.375rem]">{s.title}</p>
                <p className="mt-1 text-body text-title">{s.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {!r.viewingAs && (
          <div className="pt-6">
            <PillButton variant="outline" size="md" block onClick={() => void signOut()}>
              Cerrar sesión
            </PillButton>
          </div>
        )}
      </div>
    </div>
  );
}
