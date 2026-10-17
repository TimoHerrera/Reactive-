"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { InlineLoading } from "@/components/Loading";
import { QueryError } from "@/components/QueryError";
import { useAlerts } from "@/components/notify/useAlerts";
import { IconArrowLeft } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { ALERT_KIND_LABEL, since, type Alert, type AlertKind } from "@/lib/notify/alerts";

const KIND_CLASS: Record<AlertKind, string> = {
  vence: "bg-warning/20 text-warning",
  vencido: "bg-danger/20 text-danger-ink",
  pack: "bg-warning/20 text-warning",
  reprogramacion: "bg-accent/20 text-ink",
};

/** Avisos del profe: lo nuevo arriba; tocar uno lo marca como visto y lleva a la ficha o a la agenda. */
export function AvisosView() {
  const router = useRouter();
  const a = useAlerts();

  const open = (alert: Alert) => {
    void a.markSeen([alert.key]);
    router.push(alert.href);
  };

  const item = (alert: Alert, isNew: boolean) => (
    <li key={alert.key}>
      <button
        type="button"
        onClick={() => open(alert)}
        className={cn(
          "w-full rounded-lg border p-4 text-left",
          isNew ? "border-line bg-surface hover:bg-surface-2" : "border-line/60 bg-transparent opacity-70 hover:opacity-100",
        )}
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              {isNew && <span aria-label="Nuevo" className="h-2 w-2 shrink-0 rounded-full bg-danger" />}
              <span className="block text-title-sm">{alert.title}</span>
            </span>
            <span className="mt-1 block text-small text-muted">{alert.detail}</span>
          </span>
          <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-caption font-bold", KIND_CLASS[alert.kind])}>
            {ALERT_KIND_LABEL[alert.kind]}
          </span>
        </span>
        <span className="mt-2 block text-caption text-muted">{since(alert.date, a.today)}</span>
      </button>
    </li>
  );

  return (
    <div className="pb-10">
      <header className="bg-grid px-gutter pb-5 pt-6">
        <Link href="/coach" className="-ml-1 inline-flex min-h-[44px] items-center gap-2 text-body text-title hover:text-ink">
          <IconArrowLeft className="h-5 w-5" /> Panel
        </Link>
        <h1 className="display mt-2 text-display-xl text-title">Avisos</h1>
        <p className="mt-1 text-body text-title">
          {a.loading ? "Cargando…" : a.fresh.length ? `${a.fresh.length} ${a.fresh.length === 1 ? "nuevo" : "nuevos"}` : "Estás al día."}
        </p>
        <Link href="/coach/avisos/configurar" className="mt-4 inline-flex min-h-[44px] items-center rounded-full border border-line px-4 text-small font-bold hover:bg-surface-2">
          Configurar mis avisos
        </Link>
      </header>

      <div className="space-y-3 px-gutter">
        {a.error && a.loading && <QueryError what="los avisos" onRetry={() => void a.reload()} />}
        {a.loading && !a.error && <InlineLoading />}

        {!a.loading && a.alerts.length === 0 && (
          <p className="rounded-lg border-2 border-dashed border-line p-6 text-center text-small text-muted">
            No hay avisos. Cuando a alguien le falte poco para vencer, no pague o se le termine el pack, te aparece acá.
          </p>
        )}

        {a.fresh.length > 0 && (
          <section aria-labelledby="nuevos">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id="nuevos" className="label">
                Nuevos
              </h2>
              <button type="button" onClick={() => void a.markSeen(a.fresh.map((x) => x.key))} className="min-h-[44px] px-2 text-small font-semibold text-title hover:underline">
                Marcar todos como vistos
              </button>
            </div>
            <ul className="space-y-2">{a.fresh.map((x) => item(x, true))}</ul>
          </section>
        )}

        {a.old.length > 0 && (
          <section aria-labelledby="vistos" className="pt-2">
            <h2 id="vistos" className="label mb-2">
              Vistos
            </h2>
            <ul className="space-y-2">{a.old.map((x) => item(x, false))}</ul>
          </section>
        )}
      </div>
    </div>
  );
}
