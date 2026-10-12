"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PillButton, Stripe } from "@/components/ui";
import { IconCheck } from "@/components/ui/icons";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

const firstName = (full: string) => full.split(" ")[0] ?? full;

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

function Publicada() {
  const params = useSearchParams();
  const clientIds = (params.get("c") ?? "").split(",").filter(Boolean);
  const template = params.get("t") === "1";
  const edited = params.get("e") === "1";
  const clients = useQuery(() => Promise.all(clientIds.map((id) => data.profiles.get(id))), [params.get("c")]);

  if (clientIds.length && !clients.data) return <Loading />;
  const names = (clients.data ?? []).filter(Boolean).map((c) => firstName(c!.fullName));
  const first = clients.data?.[0] ?? null;
  const onlyTemplate = clientIds.length === 0 && template;

  const title = onlyTemplate ? "Plantilla guardada" : edited ? "Rutina actualizada" : "Rutina publicada";
  const sub = onlyTemplate
    ? "Ya la podés usar para cualquier cliente."
    : names.length === 1
      ? `${names[0]} ya la puede ver.`
      : `${joinNames(names)} ya la pueden ver.`;
  const detail = [
    !onlyTemplate && "La ven en Hoy y en Mi Rutina apenas abran la app.",
    template && !onlyTemplate && "La plantilla quedó guardada en Rutinas.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="bg-grid flex min-h-dvh flex-col overflow-hidden px-gutter pb-8 pt-20">
      <div className="flex flex-1 flex-col items-center text-center">
        <span className="flex h-32 w-32 items-center justify-center rounded-full bg-success text-bg">
          <IconCheck className="h-14 w-14" />
        </span>
        <h1 className="display mt-10 text-display-xl">{title}</h1>
        <p className="mt-4 text-body">{sub}</p>
        <Stripe tilt className="-mx-8 my-10 self-stretch text-[2rem]">
          ¡Sin rutinas genéricas!
        </Stripe>
        {detail && <p className="max-w-[20rem] text-small text-muted">{detail}</p>}
      </div>
      <div className="space-y-3">
        {first && (
          <PillButton href={`/app?como=${first.id}`} variant="inverse" arrow block>
            Ver como {firstName(first.fullName)}
          </PillButton>
        )}
        {onlyTemplate && (
          <PillButton href="/coach/rutinas?tab=plantillas" variant="inverse" arrow block>
            Ver plantillas
          </PillButton>
        )}
        <Link
          href="/coach"
          className="flex h-14 w-full items-center justify-center rounded-full border border-line text-body font-semibold hover:bg-surface"
        >
          Volver al panel
        </Link>
      </div>
    </div>
  );
}

export default function PublicadaPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Publicada />
    </Suspense>
  );
}
