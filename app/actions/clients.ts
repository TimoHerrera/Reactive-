"use server";

import { coachForNewClient } from "@/lib/access/scope";
import { activeStaffId, callerRole, invite, type InviteResult } from "@/lib/supabase/invite";
import type { NewClientInput } from "@/lib/data/repositories";

/** «+ Cliente»: el profe invita por email y el cliente queda asignado a él; el admin elige el profe. */
export async function inviteClient(input: NewClientInput): Promise<InviteResult> {
  const caller = await callerRole();
  if (!caller || (caller.role !== "coach" && caller.role !== "admin")) return { ok: false, error: "No autorizado." };
  if (!input.fullName.trim() || !/^\S+@\S+\.\S+$/.test(input.email)) return { ok: false, error: "Revisá nombre y email." };
  const coachId = await activeStaffId(coachForNewClient(caller, input.coachId));
  if (!coachId) return { ok: false, error: "Elegí un profe activo." };
  return invite({ ...input, role: "client", coachId }, caller.id);
}
