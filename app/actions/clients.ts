"use server";

import { getAdminSupabase, getServerSupabase } from "@/lib/supabase/server";
import type { NewClientInput } from "@/lib/data/repositories";
import type { Profile, Role } from "@/lib/data/types";

type Result = { ok: true; profile: Profile } | { ok: false; error: string };

async function callerRole(): Promise<{ id: string; role: Role } | null> {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: row } = await supabase.from("profiles").select("id, role").eq("id", data.user.id).maybeSingle();
  return row ? { id: row.id as string, role: row.role as Role } : null;
}

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function invite(
  input: NewClientInput & { role: Role; title?: string | null },
  invitedBy: string,
): Promise<Result> {
  const admin = getAdminSupabase();
  const email = input.email.trim().toLowerCase();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/nueva-contrasena`,
    data: { full_name: input.fullName },
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message.includes("already") ? "Ya existe un usuario con ese email." : "No pudimos enviar la invitación." };
  }
  const row = {
    id: data.user.id,
    role: input.role,
    email,
    full_name: input.fullName,
    phone: input.phone ?? null,
    title: input.title ?? null,
    sport: input.sport ?? null,
    case_type: input.caseType ?? null,
    case_detail: input.caseDetail ?? null,
    goal: input.goal ?? null,
    coach_id: input.role === "client" ? (input.coachId ?? invitedBy) : null,
    client_since: input.role === "client" ? new Date().toISOString().slice(0, 10) : null,
  };
  const { data: saved, error: insErr } = await admin.from("profiles").upsert(row).select().single();
  if (insErr || !saved) return { ok: false, error: "Se envió la invitación pero no se pudo crear el perfil." };
  return {
    ok: true,
    profile: {
      id: saved.id,
      role: saved.role,
      fullName: saved.full_name,
      email: saved.email,
      phone: saved.phone,
      title: saved.title,
      sport: saved.sport,
      caseType: saved.case_type,
      caseDetail: saved.case_detail,
      goal: saved.goal,
      coachId: saved.coach_id,
      clientSince: saved.client_since,
      createdAt: saved.created_at,
    },
  };
}

/** «+ Cliente»: el profe (o admin) invita por email. No hay registro público. */
export async function inviteClient(input: NewClientInput): Promise<Result> {
  const caller = await callerRole();
  if (!caller || (caller.role !== "coach" && caller.role !== "admin")) return { ok: false, error: "No autorizado." };
  if (!input.fullName.trim() || !/^\S+@\S+\.\S+$/.test(input.email)) return { ok: false, error: "Revisá nombre y email." };
  return invite({ ...input, role: "client" }, caller.id);
}

/** Solo el admin gestiona profes. */
export async function inviteCoach(input: { fullName: string; email: string; title?: string | null; role?: "coach" | "admin" }): Promise<Result> {
  const caller = await callerRole();
  if (!caller || caller.role !== "admin") return { ok: false, error: "Solo un admin puede sumar profes." };
  return invite({ fullName: input.fullName, email: input.email, title: input.title, role: input.role ?? "coach" }, caller.id);
}
