"use client";

import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Loading } from "@/components/Loading";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useSession } from "@/components/SessionProvider";
import { StaffProfileForm } from "@/components/coach/StaffProfileForm";
import { AccountStatusBadge, AdminOnly, BackHeader, ShareBox } from "@/components/coach/TeamParts";
import { PillButton } from "@/components/ui";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/hooks";
import { cn } from "@/lib/cn";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4" aria-label={title}>
      <h2 className="display text-h2">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

type Msg = { ok: boolean; text: string } | null;
function Feedback({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-small text-success" : "text-small font-medium text-danger-ink"}>
      {msg.ok ? "✓" : "✕"} {msg.text}
    </p>
  );
}

const fmtExpiry = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

function FichaProfe() {
  const { id } = useParams<{ id: string }>();
  const { user } = useSession();
  const team = useQuery(() => data.team.list(), []);
  const [link, setLink] = useState<string | null>(null);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, Msg>>({});

  if (team.loading && !team.data) return <Loading />;
  const member = team.data?.find((p) => p.id === id);
  if (!member) return <p className="px-gutter pt-16 text-center text-muted">No encontramos a ese profe.</p>;
  const isMe = user?.id === member.id;
  const others = (team.data ?? []).filter((p) => p.id !== member.id && p.status !== "desactivado");

  async function run(key: string, fn: () => Promise<string | void>) {
    setBusy(key);
    setMsg((m) => ({ ...m, [key]: null }));
    try {
      const text = await fn();
      if (text) setMsg((m) => ({ ...m, [key]: { ok: true, text } }));
      await team.reload();
    } catch (err) {
      setMsg((m) => ({ ...m, [key]: { ok: false, text: (err as Error).message || "Algo falló." } }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="pb-10">
      <BackHeader href="/coach/equipo" label="Equipo" title="Ficha" />
      <div className="space-y-4 px-gutter">
        <header className="flex items-center gap-4">
          <ProfileAvatar name={member.fullName} avatarPath={member.avatarPath} size="lg" pro />
          <div className="min-w-0">
            <p className="display text-h1">{member.fullName}</p>
            <p className="text-small text-muted">
              {member.role === "admin" ? "Admin" : "Profe"} · {member.clientCount === 1 ? "1 cliente" : `${member.clientCount} clientes`}
            </p>
            <div className="mt-1">
              <AccountStatusBadge status={member.status} />
            </div>
          </div>
        </header>

        {member.status === "pendiente" && (
          <Section title="Invitación">
            <p className="text-small text-muted">Todavía no creó su contraseña.</p>
            <div className="flex flex-wrap gap-2">
              <PillButton
                type="button"
                size="sm"
                variant="inverse"
                disabled={!!busy}
                onClick={() =>
                  void run("invite", async () => {
                    const r = await data.team.resend(member.id);
                    setLink(r.activationLink);
                    return r.activationLink ? "Nuevo link generado." : `Le reenviamos la invitación a ${member.email}.`;
                  })
                }
              >
                Reenviar invitación
              </PillButton>
              <PillButton
                type="button"
                size="sm"
                variant="outline"
                disabled={!!busy}
                onClick={() =>
                  void run("invite", async () => {
                    setCode(await data.team.createCode(member.id));
                  })
                }
              >
                Generar código
              </PillButton>
            </div>
            <Feedback msg={msg.invite ?? null} />
            {link && <ShareBox label="Link de activación" value={link} testId="activation-link" />}
            {code && (
              <ShareBox
                label="Código de invitación"
                value={code.code}
                testId="invite-code"
                hint={`Un solo uso, solo para ${member.email}. Vence el ${fmtExpiry(code.expiresAt)}. Se canjea en /activar → «¿Tenés un código?». No lo vas a poder ver de nuevo.`}
              />
            )}
          </Section>
        )}

        <Section title="Datos">
          <StaffProfileForm key={member.id} profile={member} onSaved={() => void team.reload()} />
        </Section>

        {!isMe && member.status !== "desactivado" && (
          <Section title="Rol">
            <div className="flex gap-2">
              {(
                [
                  ["coach", "Profe"],
                  ["admin", "Admin"],
                ] as const
              ).map(([role, label]) => (
                <button
                  key={role}
                  type="button"
                  aria-pressed={member.role === role}
                  disabled={!!busy || member.role === role}
                  onClick={() =>
                    void run("role", async () => {
                      await data.team.setRole(member.id, role);
                      return `Ahora es ${label.toLowerCase()}.`;
                    })
                  }
                  className={cn(
                    "h-11 flex-1 rounded-full text-body font-bold",
                    member.role === role ? "bg-accent text-ink" : "border border-line text-title hover:bg-surface-2",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Feedback msg={msg.role ?? null} />
          </Section>
        )}

        {!isMe && (
          <Section title="Acceso">
            {member.status === "desactivado" ? (
              <>
                <p className="text-small text-muted">Desactivado: no puede entrar ni ver datos. Su historial queda guardado.</p>
                <PillButton
                  type="button"
                  size="sm"
                  variant="inverse"
                  disabled={!!busy}
                  onClick={() =>
                    void run("access", async () => {
                      await data.team.reactivate(member.id);
                      return "Reactivado.";
                    })
                  }
                >
                  Reactivar
                </PillButton>
              </>
            ) : (
              <>
                <p className="text-small text-muted">Al desactivarlo pierde el acceso al instante. Las rutinas y el historial quedan.</p>
                {member.clientCount > 0 && (
                  <div>
                    <label htmlFor="reassign" className="label mb-2 block">
                      Pasar sus {member.clientCount} clientes a
                    </label>
                    <select
                      id="reassign"
                      value={reassignTo}
                      onChange={(e) => setReassignTo(e.target.value)}
                      className="h-12 w-full rounded-md border border-line bg-surface px-3 text-body text-ink focus:border-accent"
                    >
                      <option value="">Elegí un profe…</option>
                      {others.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.fullName}
                          {p.status === "pendiente" ? " (pendiente)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="button"
                  disabled={!!busy || (member.clientCount > 0 && !reassignTo)}
                  onClick={() => {
                    if (!window.confirm(`¿Desactivar a ${member.fullName}? Pierde el acceso al instante.`)) return;
                    void run("access", async () => {
                      await data.team.deactivate(member.id, reassignTo || null);
                      return "Desactivado.";
                    });
                  }}
                  className="flex h-11 w-full items-center justify-center rounded-full border-2 border-danger text-body font-bold text-danger-ink disabled:opacity-40"
                >
                  Desactivar profe
                </button>
              </>
            )}
            <Feedback msg={msg.access ?? null} />
          </Section>
        )}
      </div>
    </div>
  );
}

export default function FichaProfePage() {
  return (
    <AdminOnly>
      <FichaProfe />
    </AdminOnly>
  );
}
