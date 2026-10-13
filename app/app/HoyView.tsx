"use client";

import { ProfileAvatar } from "@/components/ProfileAvatar";
import Link from "next/link";
import { EmptyRoutine } from "@/components/client/EmptyRoutine";
import { useClientRoutine } from "@/components/client/useClientRoutine";
import { PickClientNotice, ViewAsBanner } from "@/components/client/ViewAsBanner";
import { WeekRing } from "@/components/client/WeekRing";
import { Loading } from "@/components/Loading";
import { BrushNote, LogoMark, PillButton } from "@/components/ui";
import { DuotonePlaceholder } from "@/components/video/ExerciseThumb";
import { formatLong, todayISO } from "@/lib/dates";
import { itemsOfDay } from "@/lib/routine/locate";
import { estimateMinutes, suggestedDay, todayLine, weekSummary } from "@/lib/routine/progress";

export function HoyView() {
  const r = useClientRoutine();

  if (r.viewingAs && !r.clientId) return <PickClientNotice />;
  if (r.loading) return <Loading />;

  const d = r.data;
  const firstName = d?.client?.fullName.split(" ")[0] ?? "";
  const routine = d?.routine ?? null;
  const day = routine ? suggestedDay(routine, d!.sessions) : null;
  const week = routine ? weekSummary(routine, d!.sessions) : null;
  const coach = d?.coach ?? null;

  if (!routine || !day) {
    return (
      <>
        {r.viewingAs && <ViewAsBanner client={d?.client ?? null} />}
        <EmptyRoutine title={`Hola, ${firstName}`} />
      </>
    );
  }

  const count = itemsOfDay(day).length;

  return (
    <div className="pb-8">
      {r.viewingAs && <ViewAsBanner client={d!.client} />}

      <header className="bg-grid px-gutter pb-6 pt-10">
        <div className="flex items-start justify-between gap-3">
          <p className="label">{formatLong(todayISO())}</p>
          <LogoMark className="h-7 w-6 text-ink" />
        </div>
        <h1 className="display mt-3 text-display-xl">Hola, {firstName}</h1>
        <p className="mt-2 text-body text-title">{todayLine(day)}</p>
      </header>

      <div className="space-y-3 px-gutter">
        {/* Sesión de hoy */}
        <section className="overflow-hidden rounded-lg border border-line bg-surface" aria-labelledby="sesion-hoy">
          <div className="relative h-36">
            <DuotonePlaceholder className="absolute inset-0 !bg-[#0F1A3D]" />
            <span className="absolute bottom-[calc(24%-14px)] left-4 rounded-full bg-ink px-3 py-1.5 text-caption font-bold uppercase tracking-[.08em] text-bg">
              Tu sesión de hoy
            </span>
          </div>
          <div className="p-4 pt-5">
            <h2 id="sesion-hoy" className="display text-h1">
              Día {day.label}
              {day.title && ` — ${day.title}`}
            </h2>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-body text-muted">
              <span>{count} ejercicios</span>
              <span>~{estimateMinutes(day)} min</span>
              <span>{routine.name}</span>
            </p>
            <PillButton href={`/app/rutina?dia=${day.id}`} arrow block className="mt-5 h-16 text-[1.75rem]">
              Empezar
            </PillButton>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <section className="rounded-lg border border-line bg-surface p-4" aria-label="Tu semana">
            <p className="label">Tu semana</p>
            <div className="mt-3">{week && <WeekRing {...week} />}</div>
          </section>
          <section className="flex flex-col rounded-lg border border-line bg-surface p-4" aria-label="Tu profe">
            <p className="label">Tu profe</p>
            {coach ? (
              <>
                <ProfileAvatar avatarPath={coach.avatarPath} name={coach.fullName} size="lg" pro className="mt-3" />
                <p className="mt-3 text-title-sm">{coach.fullName}</p>
                <p className="text-small text-muted">{coach.title}</p>
                <Link
                  href="/app/profe"
                  className="mt-auto inline-flex min-h-[44px] items-end text-small font-semibold underline decoration-accent decoration-2 underline-offset-4"
                >
                  Ver perfil
                </Link>
              </>
            ) : (
              <p className="mt-3 text-small text-muted">Todavía no tenés profe asignado.</p>
            )}
          </section>
        </div>

        {routine.clientMessage && (
          <BrushNote className="!mt-6">{routine.clientMessage}</BrushNote>
        )}
      </div>
    </div>
  );
}
