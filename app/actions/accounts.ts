"use server";

// Bajas de usuarios con Supabase (service role, nunca llega al cliente).
// - Desactivar/reactivar cliente: admin o su profe. Bloquea el login (ban) y RLS le corta la lectura.
// - Eliminar definitivamente: admin (a cualquiera) o el profe (solo sus clientes). Borra el usuario de auth → el perfil cae en cascada y, con él,
//   rutinas, sesiones, checks, vistas y observaciones (FKs de 0001). El email queda libre.
// Mismas reglas que el mock (lib/data/mock/index.ts → setClientActive / remove).
import { normalizeEmail } from "@/lib/access/rules";
import { canDeleteUser } from "@/lib/access/scope";
import { sameName } from "@/lib/data/errors";
import type { Profile } from "@/lib/data/types";
import { activeStaffId, callerRole, toProfileRow } from "@/lib/supabase/invite";
import { getAdminSupabase, getServerSupabase } from "@/lib/supabase/server";

type Fail = { ok: false; error: string };
const BAN_FOREVER = "876000h";

/** Admin o profe activo. */
async function activeCaller() {
  const caller = await callerRole();
  if (!caller || (caller.role !== "coach" && caller.role !== "admin")) return null;
  const { data } = await getAdminSupabase().from("profiles").select("disabled_at").eq("id", caller.id).maybeSingle();
  return data && !data.disabled_at ? caller : null;
}

export async function setClientActive(clientId: string, active: boolean): Promise<{ ok: true; profile: Profile } | Fail> {
  const caller = await activeCaller();
  if (!caller) return { ok: false, error: "No autorizado." };
  // RLS decide si lo puede ver: admin (todos) o su profe (coach_id = él).
  const supabase = await getServerSupabase();
  const { data: visible } = await supabase.from("profiles").select("id, role").eq("id", clientId).maybeSingle();
  if (!visible || visible.role !== "client") return { ok: false, error: "Cliente no encontrado." };

  const admin = getAdminSupabase();
  const { data: saved, error } = await admin
    .from("profiles")
    .update({ disabled_at: active ? null : new Date().toISOString() })
    .eq("id", clientId)
    .select()
    .single();
  if (error || !saved) return { ok: false, error: "No pudimos cambiar el acceso." };
  await admin.auth.admin.updateUserById(clientId, { ban_duration: active ? "none" : BAN_FOREVER });
  return { ok: true, profile: toProfileRow(saved) };
}

export async function deleteUser(profileId: string, opts: { confirmName: string; reassignTo?: string | null }): Promise<{ ok: true } | Fail> {
  const caller = await activeCaller();
  if (!caller) return { ok: false, error: "No autorizado." };
  if (profileId === caller.id) return { ok: false, error: "No podés eliminarte a vos." };

  // RLS decide qué ve: el admin, a todos; el profe, solo sus clientes (los de otros profes ni existen para él).
  const supabase = await getServerSupabase();
  const { data: p } = await supabase.from("profiles").select("id, role, coach_id, full_name, email").eq("id", profileId).maybeSingle();
  if (!p) return { ok: false, error: "Usuario no encontrado." };
  // Admin: cualquiera. Profe: solo sus propios clientes.
  if (!canDeleteUser(caller, { id: p.id, role: p.role, coachId: p.coach_id })) {
    return { ok: false, error: "Solo un admin puede eliminar profes." };
  }
  if (!sameName(opts.confirmName, p.full_name)) return { ok: false, error: `Escribí «${p.full_name}» para confirmar.` };
  const admin = getAdminSupabase();

  if (p.role === "client") {
    // Solicitudes con su email (o vinculadas a él). El resto cae en cascada al borrar el perfil.
    await admin.from("access_requests").delete().or(`email.eq."${normalizeEmail(p.email ?? "")}",linked_profile_id.eq.${p.id}`);
  } else {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client").eq("coach_id", p.id);
    if ((count ?? 0) > 0) {
      const target = opts.reassignTo && opts.reassignTo !== p.id ? await activeStaffId(opts.reassignTo) : null;
      if (!target) return { ok: false, error: `Primero reasigná sus ${count} clientes a otro profe.` };
      await admin.from("profiles").update({ coach_id: target }).eq("role", "client").eq("coach_id", p.id);
    }
    // Lo que creó para todos pasa al admin; en el resto queda en null (on delete set null).
    await admin.from("exercises").update({ created_by: caller.id }).eq("created_by", p.id);
    await admin.from("routines").update({ created_by: caller.id }).eq("created_by", p.id).or("is_template.eq.true,client_id.is.null");
    await admin
      .from("access_requests")
      .update({ requested_coach_id: opts.reassignTo ?? null })
      .eq("status", "pending")
      .eq("requested_coach_id", p.id);
  }

  const { error } = await admin.auth.admin.deleteUser(p.id);
  if (error) {
    // Sin usuario de auth (perfil huérfano): se borra el perfil directo.
    const { error: e2 } = await admin.from("profiles").delete().eq("id", p.id);
    if (e2) return { ok: false, error: "No pudimos eliminarlo." };
  }
  return { ok: true };
}
