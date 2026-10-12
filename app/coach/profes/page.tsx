"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { InlineLoading } from "@/components/Loading";
import { useSession } from "@/components/SessionProvider";
import { Avatar, Input, PillButton, StatusBadge } from "@/components/ui";
import { IconArrowLeft } from "@/components/ui/icons";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

/** Gestión de profes: solo admin (RLS + server action lo hacen cumplir en Supabase). */
export default function ProfesPage() {
  const { user } = useSession();
  const staff = useQuery(() => data.profiles.listStaff(), []);
  const [form, setForm] = useState({ fullName: "", email: "", title: "", admin: false });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (user && user.role !== "admin") {
    return (
      <div className="px-gutter pt-16 text-center">
        <p className="display text-h1">Solo para admins</p>
        <p className="mt-3 text-muted">Pedile a un admin de Reactive que sume profes.</p>
        <PillButton href="/coach" variant="inverse" className="mt-8">
          Volver al panel
        </PillButton>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim() || !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setMsg({ ok: false, text: "Revisá nombre y email." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const p = await data.profiles.createStaff({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        title: form.title.trim() || null,
        role: form.admin ? "admin" : "coach",
      });
      setMsg({ ok: true, text: data.kind === "supabase" ? `Le mandamos la invitación a ${p.email}.` : `${p.fullName} ya puede entrar (modo demo).` });
      setForm({ fullName: "", email: "", title: "", admin: false });
      void staff.reload();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-10">
      <header className="px-gutter pb-4 pt-6">
        <Link href="/coach" className="-ml-1 inline-flex min-h-[44px] items-center gap-2 text-body text-title hover:text-ink">
          <IconArrowLeft className="h-5 w-5" /> Panel
        </Link>
        <h1 className="display mt-2 text-display-xl text-title">Profes</h1>
      </header>
      <div className="space-y-6 px-gutter">
        {staff.loading && !staff.data ? (
          <InlineLoading />
        ) : (
          <ul className="space-y-2">
            {(staff.data ?? []).map((p) => (
              <li key={p.id} className="flex min-h-[64px] items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
                <Avatar name={p.fullName} size="sm" pro />
                <span className="min-w-0 flex-1">
                  <span className="block text-title-sm">{p.fullName}</span>
                  <span className="block truncate text-small text-muted">{[p.title, p.email].filter(Boolean).join(" · ")}</span>
                </span>
                {p.role === "admin" && <StatusBadge status="plantilla">Admin</StatusBadge>}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-line bg-surface p-4" noValidate>
          <h2 className="display text-h2">Sumar profe</h2>
          <Input label="Nombre" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label="Especialidad" placeholder="Kinesiólogo deportivo" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <label className="flex min-h-[44px] items-center gap-3 text-body">
            <input type="checkbox" checked={form.admin} onChange={(e) => setForm((f) => ({ ...f, admin: e.target.checked }))} className="h-5 w-5 accent-accent" />
            También es admin (puede sumar profes)
          </label>
          {msg && (
            <p role="status" className={msg.ok ? "text-small text-success" : "text-small text-danger-ink"}>
              {msg.ok ? "✓" : "✕"} {msg.text}
            </p>
          )}
          <PillButton type="submit" block arrow disabled={busy}>
            {busy ? "Enviando…" : "Invitar"}
          </PillButton>
        </form>
      </div>
    </div>
  );
}
