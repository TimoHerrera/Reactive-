"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { NoAccess } from "@/components/coach/NoAccess";
import { saveDraft } from "@/components/coach/routine/useDraft";
import { Loading } from "@/components/Loading";
import { useSession } from "@/components/SessionProvider";
import { PillButton } from "@/components/ui";
import { canEditRoutine } from "@/lib/access/scope";
import { data } from "@/lib/data";
import { treeToDraft } from "@/lib/routine/draft";

const MODES = { editar: "edit", duplicar: "duplicate", usar: "template" } as const;

/** /coach/rutinas/[id]/editar | duplicar | usar → arma el borrador y abre el wizard. */
function StartFromRoutine() {
  const { id, accion } = useParams<{ id: string; accion: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState<string | null>(null);

  useEffect(() => {
    const mode = MODES[accion as keyof typeof MODES];
    if (!mode) {
      setError("Acción desconocida.");
      return;
    }
    if (!user) return;
    let alive = true;
    data.routines.getTree(id).then(async (tree) => {
      if (!alive) return;
      // Ajena o inexistente: la capa de datos (RLS) no la devuelve.
      if (!tree) return setDenied("Esta rutina no existe o es de un cliente de otro profe.");
      if (mode === "edit") {
        const owner = tree.clientId ? await data.profiles.get(tree.clientId) : null;
        if (!alive) return;
        if (!canEditRoutine(user, tree, owner)) {
          return setDenied(tree.isTemplate ? "Esta plantilla la edita solo quien la creó (o el admin). Podés usarla o duplicarla." : "No podés editar esta rutina.");
        }
      }
      const draft = treeToDraft(tree, mode);
      const cliente = params.get("cliente");
      if (cliente && mode !== "edit") draft.clientIds = [cliente];
      saveDraft(draft);
      router.replace("/coach/rutinas/nueva/manual?paso=1");
    });
    return () => {
      alive = false;
    };
  }, [id, accion, params, router, user]);

  if (denied) return <NoAccess text={denied} href="/coach/rutinas" label="Volver a Rutinas" />;
  if (error) {
    return (
      <div className="px-gutter pt-16 text-center">
        <p className="display text-h1">{error}</p>
        <PillButton href="/coach/rutinas" variant="inverse" className="mt-8">
          Volver a Rutinas
        </PillButton>
      </div>
    );
  }
  return <Loading label="Preparando la rutina…" />;
}

export default function RoutineActionPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StartFromRoutine />
    </Suspense>
  );
}
