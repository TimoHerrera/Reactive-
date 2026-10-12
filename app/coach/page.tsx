"use client";

import { PagePlaceholder } from "@/components/PagePlaceholder";
import { data, hasVideo } from "@/lib/data";
import { useQuery } from "@/lib/hooks";
import { clientRoutineFilter, routineStatus } from "@/lib/routine/status";
import { resetMockDb } from "@/lib/data/mock/store";
import { PillButton } from "@/components/ui";

export default function PanelPage() {
  const stats = useQuery(async () => {
    const [clients, routines, exercises] = await Promise.all([
      data.profiles.listClients(),
      data.routines.list(),
      data.exercises.list(),
    ]);
    const byClient = (id: string) => routines.filter((r) => r.clientId === id);
    return {
      activos: clients.filter((c) => clientRoutineFilter(byClient(c.id)) !== "sin-rutina").length,
      vencen: routines.filter((r) => routineStatus(r) === "por-vencer").length,
      sinVideo: exercises.filter((e) => !hasVideo(e)).length,
    };
  }, []);

  return (
    <PagePlaceholder kicker="Modo profe" title="Panel" phase="F6">
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Clientes activos", stats.data?.activos],
          ["Rutinas vencen esta semana", stats.data?.vencen],
          ["Ejercicios sin video", stats.data?.sinVideo],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-lg border border-line bg-surface p-3">
            <p className="display text-h1">{value ?? "–"}</p>
            <p className="mt-1 text-caption text-muted">{label}</p>
          </div>
        ))}
      </div>
      {data.kind === "mock" && (
        <PillButton variant="outline" size="sm" block onClick={resetMockDb}>
          Restablecer datos demo
        </PillButton>
      )}
    </PagePlaceholder>
  );
}
