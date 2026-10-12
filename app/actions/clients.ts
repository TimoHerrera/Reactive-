"use server";

import { callerRole, invite, type InviteResult } from "@/lib/supabase/invite";
import type { NewClientInput } from "@/lib/data/repositories";

/** «+ Cliente»: el profe (o admin) invita por email. No hay registro público. */
export async function inviteClient(input: NewClientInput): Promise<InviteResult> {
  const caller = await callerRole();
  if (!caller || (caller.role !== "coach" && caller.role !== "admin")) return { ok: false, error: "No autorizado." };
  if (!input.fullName.trim() || !/^\S+@\S+\.\S+$/.test(input.email)) return { ok: false, error: "Revisá nombre y email." };
  return invite({ ...input, role: "client" }, caller.id);
}

/** Solo el admin gestiona profes. */
export async function inviteCoach(input: { fullName: string; email: string; title?: string | null; role?: "coach" | "admin" }): Promise<InviteResult> {
  const caller = await callerRole();
  if (!caller || caller.role !== "admin") return { ok: false, error: "Solo un admin puede sumar profes." };
  return invite({ fullName: input.fullName, email: input.email, title: input.title, role: input.role ?? "coach" }, caller.id);
}
