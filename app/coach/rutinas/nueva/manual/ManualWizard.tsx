"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loading } from "@/components/Loading";
import { useSession } from "@/components/SessionProvider";
import { StepData } from "@/components/coach/routine/StepData";
import { StepDays } from "@/components/coach/routine/StepDays";
import { StepPublish } from "@/components/coach/routine/StepPublish";
import { clearDraft, useDraft } from "@/components/coach/routine/useDraft";
import { WizardHeader } from "@/components/coach/routine/WizardHeader";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/hooks";
import { publishDraft } from "@/lib/routine/publish";

const KICKER: Record<string, string> = {
  manual: "Carga manual",
  template: "Desde plantilla",
  duplicate: "Duplicar rutina",
  edit: "Editar rutina",
  excel: "Importar Excel",
};

export function ManualWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const step = (Number(params.get("paso")) || 1) as 1 | 2 | 3;
  const { user } = useSession();
  const { draft, loaded, update } = useDraft();
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const deps = useQuery(async () => {
    const [clients, routines, exercises] = await Promise.all([
      data.profiles.listClients(),
      data.routines.list(),
      data.exercises.list(),
    ]);
    return { clients, routines, exercises };
  }, []);

  useEffect(() => {
    if (loaded && !draft) router.replace("/coach/rutinas/nueva");
  }, [loaded, draft, router]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setError(null);
  }, [step]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!loaded || !draft || !deps.data) return <Loading />;
  const { clients, routines, exercises } = deps.data;

  const go = (n: 1 | 2 | 3) => router.push(`/coach/rutinas/nueva/manual?paso=${n}`);
  const exit = () => {
    if (draft.origin === "edit" || draft.origin === "duplicate") router.push("/coach/rutinas");
    else if (draft.origin === "excel") router.push("/coach/rutinas/nueva/importar");
    else router.push("/coach/rutinas/nueva");
  };

  async function onPublish() {
    if (!draft) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await publishDraft(draft, { clientIds: draft.clientIds, saveAsTemplate: draft.saveAsTemplate, userId: user?.id ?? null });
      clearDraft();
      const q = new URLSearchParams();
      if (res.routineIds.length) q.set("c", res.routineIds.map((r) => r.clientId).join(","));
      if (res.templateId) q.set("t", "1");
      if (draft.routineId) q.set("e", "1");
      router.replace(`/coach/rutinas/publicada?${q.toString()}`);
    } catch (e) {
      setError(`No pudimos publicar: ${(e as Error).message}`);
      setPublishing(false);
    }
  }

  async function onSaveTemplate() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setToast("Poné un nombre en el paso 1 antes de guardarla.");
      return;
    }
    setPublishing(true);
    try {
      await publishDraft(
        draft.isTemplate && draft.routineId ? draft : { ...draft, routineId: undefined, isTemplate: false },
        { clientIds: [], saveAsTemplate: true, userId: user?.id ?? null },
      );
      setToast("Plantilla guardada en Rutinas › Plantillas.");
    } catch (e) {
      setToast(`No se pudo guardar: ${(e as Error).message}`);
    } finally {
      setPublishing(false);
    }
  }

  const kicker = `${KICKER[draft.origin] ?? "Nueva rutina"} · Paso ${step} de 3`;

  return (
    <div>
      {step === 1 && (
        <>
          <WizardHeader step={1} kicker={kicker} onBack={exit} />
          <StepData draft={draft} update={update} clients={clients} onNext={() => go(2)} />
        </>
      )}
      {step === 2 && (
        <>
          <WizardHeader step={2} kicker={`Paso 2 de 3 · Días y ejercicios`} subtitle={draft.name} onBack={() => go(1)} showSteps={false} />
          <StepDays
            draft={draft}
            update={update}
            exercises={exercises}
            onNext={() => go(3)}
            onSaveTemplate={() => void onSaveTemplate()}
            saving={publishing}
            onExercisesChanged={() => void deps.reload()}
          />
        </>
      )}
      {step === 3 && (
        <>
          <WizardHeader step={3} kicker="Paso 3 de 3 · Asignar y publicar" onBack={() => go(2)} />
          <StepPublish
            draft={draft}
            update={update}
            clients={clients}
            routines={routines}
            exercises={exercises}
            onReview={() => go(2)}
            onChangeDates={() => go(1)}
            onPublish={() => void onPublish()}
            publishing={publishing}
            error={error}
          />
        </>
      )}
      {toast && (
        <div role="status" className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-32px)] max-w-[448px] -translate-x-1/2 rounded-md bg-ink px-4 py-3 text-small font-semibold text-bg">
          {toast}
        </div>
      )}
    </div>
  );
}
