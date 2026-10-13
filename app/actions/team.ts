"use server";

// Equipo (profes y admins) con Supabase. Todo lo que toca roles, estado o invitaciones pasa por acá:
// se valida que quien llama sea admin activo y se usa la service role (nunca llega al cliente).
import { createClient } from "@supabase/supabase-js";
import type { InviteStaffInput } from "@/lib/data/repositories";
import { callerRole, invite, siteUrl, type InviteResult } from "@/lib/supabase/invite";
import { getAdminSupabase, getServerSupabase } from "@/lib/supabase/server";
import { checkInviteCode, CODE_MESSAGES, codeExpiry, generateInviteCode, hashCode } from "@/lib/team/rules";

type Fail = { ok: false; error: string };

async function requireAdmin(): Promise<{ id: string } | Fail> {
  const caller = await callerRole();
  if (!caller || caller.role !== "admin") return { ok: false, error: "Solo un admin puede gestionar el equipo." };
  const admin = getAdminSupabase();
  const { data } = await admin.from("profiles").select("disabled_at").eq("id", caller.id).maybeSingle();
  if (data?.disabled_at) return { ok: false, error: "Tu acceso está desactivado." };
  return { id: caller.id };
}

export async function inviteStaff(input: InviteStaffInput): Promise<InviteResult> {
  const me = await requireAdmin();
  if ("ok" in me) return me;
  if (!input.fullName.trim() || !/^\S+@\S+\.\S+$/.test(input.email)) return { ok: false, error: "Revisá nombre y email." };
  return invite(
    { fullName: input.fullName.trim(), email: input.email, title: input.title ?? null, phone: input.phone ?? null, role: input.role },
    me.id,
    "/activar",
  );
}

/** Reenvía la invitación. Si Supabase no deja reinvitar, manda el mail de «crear contraseña» (recovery). */
export async function resendInvite(profileId: string): Promise<{ ok: true } | Fail> {
  const me = await requireAdmin();
  if ("ok" in me) return me;
  const admin = getAdminSupabase();
  const { data: p } = await admin.from("profiles").select("email, full_name, activated_at").eq("id", profileId).maybeSingle();
  if (!p) return { ok: false, error: "No encontramos a esa persona." };
  if (p.activated_at) return { ok: false, error: "Ya activó su cuenta." };
  const redirectTo = `${siteUrl()}/auth/callback?next=${encodeURIComponent("/activar")}`;
  const { error } = await admin.auth.admin.inviteUserByEmail(p.email, { redirectTo, data: { full_name: p.full_name } });
  if (!error) return { ok: true };
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { error: err2 } = await anon.auth.resetPasswordForEmail(p.email, { redirectTo });
  return err2 ? { ok: false, error: "No pudimos reenviar la invitación." } : { ok: true };
}

/** Código de un solo uso, atado al email, 48 h. Se devuelve en claro una sola vez; se guarda hasheado. */
export async function createInviteCode(profileId: string): Promise<{ ok: true; code: string; expiresAt: string } | Fail> {
  const me = await requireAdmin();
  if ("ok" in me) return me;
  const admin = getAdminSupabase();
  const { data: p } = await admin.from("profiles").select("email, activated_at").eq("id", profileId).maybeSingle();
  if (!p) return { ok: false, error: "No encontramos a esa persona." };
  if (p.activated_at) return { ok: false, error: "Ya activó su cuenta." };
  const code = generateInviteCode();
  const expiresAt = codeExpiry();
  // Un código vigente por persona.
  await admin.from("invite_codes").update({ used_at: new Date().toISOString() }).eq("profile_id", profileId).is("used_at", null);
  const { error } = await admin.from("invite_codes").insert({
    code_hash: await hashCode(code),
    email: p.email,
    profile_id: profileId,
    expires_at: expiresAt,
    created_by: me.id,
  });
  return error ? { ok: false, error: "No pudimos generar el código." } : { ok: true, code, expiresAt };
}

/** Canje en /activar: valida el código, crea la contraseña y confirma el email. Después el cliente inicia sesión. */
export async function redeemInviteCode(email: string, code: string, password: string): Promise<{ ok: true } | Fail> {
  if (password.length < 8) return { ok: false, error: "Usá al menos 8 caracteres." };
  const admin = getAdminSupabase();
  const hash = await hashCode(code);
  const { data: rec } = await admin.from("invite_codes").select("*").eq("code_hash", hash).maybeSingle();
  const check = checkInviteCode(rec ? { email: rec.email, expiresAt: rec.expires_at, usedAt: rec.used_at } : null, email);
  if (check !== "ok") return { ok: false, error: CODE_MESSAGES[check] };
  const { data: p } = await admin.from("profiles").select("id, disabled_at").eq("id", rec!.profile_id).maybeSingle();
  if (!p || p.disabled_at) return { ok: false, error: CODE_MESSAGES["not-found"] };
  const { error } = await admin.auth.admin.updateUserById(p.id, { password, email_confirm: true });
  if (error) return { ok: false, error: "No pudimos crear la contraseña." };
  const nowIso = new Date().toISOString();
  await admin.from("invite_codes").update({ used_at: nowIso }).eq("id", rec!.id);
  await admin.from("profiles").update({ activated_at: nowIso }).eq("id", p.id).is("activated_at", null);
  return { ok: true };
}

/** Después de crear la contraseña por link: marca la cuenta como activa. */
export async function markActivated(): Promise<void> {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await getAdminSupabase().from("profiles").update({ activated_at: new Date().toISOString() }).eq("id", data.user.id).is("activated_at", null);
}

/** Desactiva: reasigna sus clientes, bloquea el login (ban) y RLS le corta la lectura al instante. */
export async function deactivateStaff(profileId: string, reassignTo: string | null): Promise<{ ok: true } | Fail> {
  const me = await requireAdmin();
  if ("ok" in me) return me;
  if (profileId === me.id) return { ok: false, error: "No podés desactivarte a vos." };
  const admin = getAdminSupabase();
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client").eq("coach_id", profileId);
  if ((count ?? 0) > 0) {
    if (!reassignTo || reassignTo === profileId) return { ok: false, error: `Elegí a qué profe pasar sus ${count} clientes.` };
    const { data: t } = await admin.from("profiles").select("role, disabled_at").eq("id", reassignTo).maybeSingle();
    if (!t || t.disabled_at || (t.role !== "coach" && t.role !== "admin")) return { ok: false, error: "Ese profe no está activo." };
    await admin.from("profiles").update({ coach_id: reassignTo }).eq("role", "client").eq("coach_id", profileId);
  }
  await admin.from("access_requests").update({ requested_coach_id: reassignTo }).eq("status", "pending").eq("requested_coach_id", profileId);
  const { error } = await admin.from("profiles").update({ disabled_at: new Date().toISOString() }).eq("id", profileId);
  if (error) return { ok: false, error: "No pudimos desactivarlo." };
  await admin.auth.admin.updateUserById(profileId, { ban_duration: "876000h" });
  return { ok: true };
}

export async function reactivateStaff(profileId: string): Promise<{ ok: true } | Fail> {
  const me = await requireAdmin();
  if ("ok" in me) return me;
  const admin = getAdminSupabase();
  await admin.auth.admin.updateUserById(profileId, { ban_duration: "none" });
  const { error } = await admin.from("profiles").update({ disabled_at: null }).eq("id", profileId);
  return error ? { ok: false, error: "No pudimos reactivarlo." } : { ok: true };
}

export async function setStaffRole(profileId: string, role: "coach" | "admin"): Promise<{ ok: true } | Fail> {
  const me = await requireAdmin();
  if ("ok" in me) return me;
  if (profileId === me.id) return { ok: false, error: "No podés cambiar tu propio rol." };
  const supabase = await getServerSupabase(); // RLS + trigger: solo admin cambia roles
  const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);
  return error ? { ok: false, error: "No pudimos cambiar el rol." } : { ok: true };
}
