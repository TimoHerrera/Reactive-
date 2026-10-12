"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { saveDraft } from "@/components/coach/routine/useDraft";
import { Loading } from "@/components/Loading";
import { PillButton } from "@/components/ui";
import { data } from "@/lib/data";
import { treeToDraft } from "@/lib/routine/draft";

const MODES = { editar: "edit", duplicar: "duplicate", usar: "template" } as const;

/** /coach/rutinas/[id]/editar | duplicar | usar → arma el borrador y abre el wizard. */
function StartFromRoutine() {
  const { id, accion } = useParams<{ id: string; accion: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mode = MODES[accion as keyof typeof MODES];
    if (!mode) {
      setError("Acción desconocida.");
      return;
    }
    let alive = true;
    data.routines.getTree(id).then((tree) => {
      if (!alive) return;
      if (!tree) return setError("No encontramos esa rutina.");
      const draft = treeToDraft(tree, mode);
      const cliente = params.get("cliente");
      if (cliente && mode !== "edit") draft.clientIds = [cliente];
      saveDraft(draft);
      router.replace("/coach/rutinas/nueva/manual?paso=1");
    });
    return () => {
      alive = false;
    };
  }, [id, accion, params, router]);

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
