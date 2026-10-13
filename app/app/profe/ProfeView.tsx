"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useClientRoutine } from "@/components/client/useClientRoutine";
import { PickClientNotice, ViewAsBanner } from "@/components/client/ViewAsBanner";
import { Loading } from "@/components/Loading";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { PillButton, Stripe } from "@/components/ui";
import { IconArrowLeft } from "@/components/ui/icons";
import { formatDM } from "@/lib/dates";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-4 border-b border-line py-3 last:border-0">
      <span className="text-body text-muted">{label}</span>
      <span className="min-w-0 text-right text-body">{children}</span>
    </div>
  );
}

/** Perfil del profesional a cargo del cliente. */
export function ProfeView() {
  const r = useClientRoutine();

  if (r.viewingAs && !r.clientId) return <PickClientNotice />;
  if (r.loading) return <Loading />;
  const coach = r.data?.coach ?? null;
  const client = r.data?.client ?? null;
  const routine = r.data?.routine ?? null;

  const phoneDigits = coach?.phone?.replace(/\D/g, "") ?? "";
  const wa = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(
        `¡Hola ${coach!.fullName.split(" ")[0]}! Soy ${(client?.fullName ?? "").replace(/\.+$/, "")}.`,
      )}`
    : null;

  return (
    <div className="pb-10">
      {r.viewingAs && <ViewAsBanner client={client} />}

      <div className="px-gutter pt-6">
        <Link
          href="/app"
          aria-label="Volver a Hoy"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-[1.375rem]"
        >
          <IconArrowLeft />
        </Link>
      </div>

      {!coach ? (
        <div className="px-gutter pt-12 text-center">
          <p className="display text-h1">Todavía no tenés profe asignado</p>
          <p className="mt-3 text-muted">Cuando Reactive te asigne un profesional, lo vas a ver acá.</p>
        </div>
      ) : (
        <>
          <header className="bg-grid flex items-center gap-4 px-gutter pb-8 pt-6">
            <ProfileAvatar name={coach.fullName} avatarPath={coach.avatarPath} size="lg" pro className="!h-20 !w-20 !text-[1.75rem]" />
            <div className="min-w-0">
              <p className="label">Tu profe</p>
              <h1 className="display mt-1 text-h1">{coach.fullName}</h1>
              {coach.title && <p className="mt-1 text-small text-muted">{coach.title}</p>}
            </div>
          </header>

          <Stripe className="whitespace-nowrap px-2 text-[min(5.3vw,1.375rem)]">¡Sin rutinas genéricas!</Stripe>

          <div className="space-y-3 px-gutter pt-6">
            {coach.bio && (
              <p className="rounded-lg border border-line bg-surface p-4 text-body text-title" aria-label="Bio del profe">
                {coach.bio}
              </p>
            )}
            <section className="rounded-lg border border-line bg-surface px-4" aria-label="Datos del profe">
              {coach.title && <Row label="Especialidad">{coach.title}</Row>}
              <Row label="Email">
                <a href={`mailto:${coach.email}`} className="underline decoration-accent decoration-2 underline-offset-4">
                  {coach.email}
                </a>
              </Row>
              {coach.phone && <Row label="WhatsApp">{coach.phone}</Row>}
            </section>

            {routine && (
              <section className="rounded-lg border border-line bg-surface p-4">
                <p className="label">Rutina que te armó</p>
                <p className="mt-2 text-title-sm">{routine.name}</p>
                <p className="text-small text-muted">
                  Vigente {formatDM(routine.startsOn)} → {formatDM(routine.endsOn)} · {routine.days.length} días
                </p>
                <PillButton href="/app/rutina" variant="inverse" size="sm" arrow className="mt-4">
                  Ver mi rutina
                </PillButton>
              </section>
            )}

            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-14 items-center justify-center gap-3 rounded-full bg-[#25D366] text-body font-bold text-bg"
              >
                Escribile a {coach.fullName.split(" ")[0]} por WhatsApp
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
