// Publicar un borrador: una rutina por cliente, reemplazo de la vigente y plantilla opcional.
import { data } from "@/lib/data";
import { addDays, diffDays, todayISO } from "@/lib/dates";
import { draftToTree, type RoutineDraft } from "./draft";
import { replacementInfo } from "./replace";

export { replacementInfo, type ReplaceInfo } from "./replace";

export type PublishResult = { routineIds: { clientId: string; routineId: string }[]; templateId: string | null };

/**
 * Publica el borrador.
 * - Edición: actualiza la misma rutina (conserva ids, sesiones y checks).
 * - Nueva: crea una rutina por cliente y acorta la vigente que se superpone (termina el día anterior).
 * - Plantilla: además (o solo) guarda una copia como plantilla.
 */
export async function publishDraft(
  draft: RoutineDraft,
  opts: { clientIds: string[]; saveAsTemplate: boolean; userId: string | null; today?: string },
): Promise<PublishResult> {
  const today = opts.today ?? todayISO();
  const now = new Date().toISOString();
  const result: PublishResult = { routineIds: [], templateId: null };

  // Edición de una plantilla existente.
  if (draft.routineId && draft.isTemplate) {
    const saved = await data.routines.saveTree(
      draftToTree(draft, { clientId: null, isTemplate: true, publishedAt: null, routineId: draft.routineId, keepIds: true, createdBy: opts.userId }),
    );
    return { routineIds: [], templateId: saved.id };
  }

  let pending = [...opts.clientIds];

  // Edición de una rutina de cliente: se actualiza en el lugar.
  if (draft.routineId) {
    const original = await data.routines.getTree(draft.routineId);
    const ownerId = original?.clientId ?? pending[0] ?? null;
    if (ownerId) {
      const saved = await data.routines.saveTree(
        draftToTree(draft, {
          clientId: ownerId,
          isTemplate: false,
          publishedAt: original?.publishedAt ?? now,
          routineId: draft.routineId,
          keepIds: true,
          createdBy: original?.createdBy ?? opts.userId,
        }),
      );
      result.routineIds.push({ clientId: ownerId, routineId: saved.id });
      pending = pending.filter((id) => id !== ownerId);
    }
  }

  for (const clientId of pending) {
    const existing = await data.routines.listForClient(clientId);
    const info = replacementInfo(existing, today);
    if ((info.kind === "active" || info.kind === "expiring") && info.routine) {
      const r = info.routine;
      // Si la vigente empezó antes, termina el día anterior a la nueva. Si no, queda sin publicar.
      if (r.startsOn && diffDays(r.startsOn, draft.startsOn) > 0) {
        await data.routines.update(r.id, { endsOn: addDays(draft.startsOn, -1) });
      }
    }
    const saved = await data.routines.saveTree(
      draftToTree(draft, { clientId, isTemplate: false, publishedAt: now, createdBy: opts.userId }),
    );
    result.routineIds.push({ clientId, routineId: saved.id });
  }

  if (opts.saveAsTemplate) {
    const saved = await data.routines.saveTree(
      draftToTree(draft, { clientId: null, isTemplate: true, publishedAt: null, createdBy: opts.userId }),
    );
    result.templateId = saved.id;
  }
  return result;
}
