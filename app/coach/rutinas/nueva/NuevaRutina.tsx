"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { saveDraft } from "@/components/coach/routine/useDraft";
import { InlineLoading } from "@/components/Loading";
import { PillButton, StatusBadge } from "@/components/ui";
import { IconX } from "@/components/ui/icons";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/hooks";
import { emptyDraft } from "@/lib/routine/draft";

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4" />
    </svg>
  );
}
function SheetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16M4 15h16M10 4v16" />
    </svg>
  );
}

/** «¿Cómo la querés cargar?»: A) carga manual, B) importar Excel, o partir de una plantilla. */
export function NuevaRutina() {
  const router = useRouter();
  const params = useSearchParams();
  const clientId = params.get("cliente");
  const templates = useQuery(async () => {
    const [routines, counts] = await Promise.all([data.routines.list(), data.routines.itemCounts()]);
    return routines.filter((r) => r.isTemplate).map((r) => ({ ...r, count: counts[r.id] ?? 0 }));
  }, []);

  const startManual = () => {
    saveDraft({ ...emptyDraft(), clientIds: clientId ? [clientId] : [] });
    router.push("/coach/rutinas/nueva/manual?paso=1");
  };

  return (
    <div className="bg-grid min-h-dvh px-gutter pb-10 pt-6">
      <Link
        href={clientId ? `/coach/clientes/${clientId}` : "/coach/rutinas"}
        aria-label="Cerrar"
        className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[1.5rem] hover:bg-surface-2"
      >
        <IconX />
      </Link>
      <p className="label mt-4">Nueva rutina</p>
      <h1 className="display mt-2 text-[3.25rem]">¿Cómo la querés cargar?</h1>
      <p className="mt-3 text-body text-muted">Elegí un camino. Los dos terminan en lo mismo: una rutina hecha a medida.</p>

      <div className="mt-6 space-y-3">
        <section className="relative rounded-lg border-2 border-accent bg-surface p-5">
          <span className="display absolute right-5 top-4 text-[2.5rem] text-line" aria-hidden="true">
            A
          </span>
          <span className="flex h-12 w-12 items-center justify-center rounded-md bg-accent text-ink">
            <PencilIcon />
          </span>
          <h2 className="display mt-4 text-h1">Carga manual</h2>
          <p className="mt-2 text-body text-title">Armala paso a paso: días, bloques y ejercicios desde la biblioteca, con autocompletado.</p>
          <PillButton size="md" arrow className="mt-5" onClick={startManual}>
            Empezar
          </PillButton>
        </section>

        <section className="relative rounded-lg border border-line bg-surface p-5">
          <span className="display absolute right-5 top-4 text-[2.5rem] text-line" aria-hidden="true">
            B
          </span>
          <span className="flex h-12 w-12 items-center justify-center rounded-md bg-ink text-bg">
            <SheetIcon />
          </span>
          <h2 className="display mt-4 text-h1">Importar Excel</h2>
          <p className="mt-2 text-body text-title">¿Ya la tenés en una planilla? Subí el .xlsx o .csv y la validamos contra la biblioteca.</p>
          <PillButton
            size="md"
            variant="inverse"
            arrow
            className="mt-5"
            href={`/coach/rutinas/nueva/importar${clientId ? `?cliente=${clientId}` : ""}`}
          >
            Subir planilla
          </PillButton>
        </section>
      </div>

      <section className="mt-8" aria-labelledby="plantillas">
        <h2 id="plantillas" className="display text-h2 text-title">
          O partí de una plantilla
        </h2>
        {templates.loading && !templates.data ? (
          <InlineLoading />
        ) : templates.data?.length ? (
          <ul className="mt-3 space-y-2">
            {templates.data.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/coach/rutinas/${t.id}/usar${clientId ? `?cliente=${clientId}` : ""}`}
                  className="flex min-h-[64px] items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 hover:bg-surface-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-title-sm">{t.name}</span>
                    <span className="block text-small text-muted">
                      {t.daysPerWeek} días · {t.count} ejercicios
                    </span>
                  </span>
                  <StatusBadge status="plantilla" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-small text-muted">Todavía no hay plantillas. Al publicar, tildá «Guardar también como plantilla».</p>
        )}
      </section>
    </div>
  );
}
