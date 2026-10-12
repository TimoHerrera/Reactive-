"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui";
import { CASE_TYPE_LABEL, data, type AccessRequest, type Profile } from "@/lib/data";
import { formatRelative } from "@/lib/dates";

type Done =
  | { kind: "approved"; profile: Profile; link: string | null }
  | { kind: "rejected" };

/** Solicitud de acceso con «Aprobar» (crea el cliente e invita) y «Rechazar» (motivo opcional). */
export function AccessRequestCard({
  request: r,
  coachName,
  onChanged,
}: {
  request: AccessRequest;
  coachName: string | null;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [copied, setCopied] = useState(false);

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await data.accessRequests.approve(r.id);
      setDone({ kind: "approved", profile: res.profile, link: res.activationLink });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    setError(null);
    try {
      await data.accessRequests.reject(r.id, reason);
      setDone({ kind: "rejected" });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done?.kind === "rejected") {
    return (
      <li className="rounded-lg border border-line bg-surface p-4 text-small text-muted">
        Rechazaste la solicitud de <strong className="text-ink">{r.fullName}</strong>.
      </li>
    );
  }

  if (done?.kind === "approved") {
    return (
      <li className="space-y-3 rounded-lg border-2 border-success bg-surface p-4">
        <p className="text-body">
          ✓ <strong>{r.fullName}</strong> ya es cliente.{" "}
          {done.link ? "Modo demo: este es el link de activación que le llegaría por mail." : `Le mandamos la invitación a ${r.email}.`}
        </p>
        {done.link && (
          <div className="flex gap-2">
            <input readOnly value={done.link} aria-label="Link de activación" className="h-11 min-w-0 flex-1 rounded-sm border border-line bg-bg px-2 text-caption text-title" />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(done.link!).then(() => setCopied(true));
              }}
              className="h-11 shrink-0 rounded-full bg-ink px-4 text-small font-bold text-bg"
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        )}
        <Link href={`/coach/clientes/${done.profile.id}`} className="inline-flex min-h-[44px] items-center text-small font-semibold underline underline-offset-4">
          Ver su ficha y asignarle una rutina →
        </Link>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-warning/70 bg-surface p-4">
      <div className="flex items-start gap-3">
        <Avatar name={r.fullName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-title-sm">{r.fullName}</p>
          <p className="truncate text-small text-muted">
            {r.email}
            {r.phone ? ` · ${r.phone}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-caption text-muted">{formatRelative(r.createdAt)}</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-small">
        <div>
          <dt className="label text-[0.625rem]">Profe</dt>
          <dd>{coachName ?? "Todavía no tiene"}</dd>
        </div>
        <div>
          <dt className="label text-[0.625rem]">Caso</dt>
          <dd>{r.caseType ? CASE_TYPE_LABEL[r.caseType] : "—"}</dd>
        </div>
      </dl>
      {r.message && <p className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-small text-title">«{r.message}»</p>}

      {mode === "idle" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => void approve()} className="h-12 rounded-full bg-ink text-small font-bold text-bg disabled:opacity-50">
            {busy ? "Aprobando…" : "Aprobar e invitar"}
          </button>
          <button type="button" disabled={busy} onClick={() => setMode("reject")} className="h-12 rounded-full border border-line text-small font-bold hover:bg-surface-2">
            Rechazar
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <label htmlFor={`motivo-${r.id}`} className="label block">
            Motivo (opcional)
          </label>
          <textarea
            id={`motivo-${r.id}`}
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej.: no atendemos ese tipo de caso"
            className="w-full rounded-md border border-line bg-bg px-3 py-2 text-body text-ink outline-none focus:border-accent"
          />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode("idle")} className="h-12 rounded-full border border-line text-small font-semibold">
              Cancelar
            </button>
            <button type="button" disabled={busy} onClick={() => void reject()} className="h-12 rounded-full bg-danger text-small font-bold text-ink disabled:opacity-50">
              {busy ? "Rechazando…" : "Confirmar rechazo"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-small text-danger-ink">✕ {error}</p>}
    </li>
  );
}
