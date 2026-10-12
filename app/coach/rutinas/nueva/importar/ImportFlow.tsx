"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { saveDraft } from "@/components/coach/routine/useDraft";
import { WizardHeader } from "@/components/coach/routine/WizardHeader";
import { data, type Exercise, type ExerciseCategory } from "@/lib/data";
import { buildMatcher, type MatchResult } from "@/lib/import/match";
import { FIELD_COUNT, type Issue, type ParseResult } from "@/lib/import/parse";
import { checkImportFile, readFile, workbookToSheets } from "@/lib/import/read";
import { parseWorkbook } from "@/lib/import/workbook";
import { importToDraft } from "@/lib/import/toDraft";
import { normalizeText } from "@/lib/text";
import { ImportErrors } from "./ImportErrors";
import { ImportPreview, rowState, type Resolution } from "./ImportPreview";
import { ImportReading, type ReadingStep } from "./ImportReading";
import { ImportStart } from "./ImportStart";

type Phase =
  | { kind: "start"; error: string | null }
  | { kind: "reading"; file: File; rows: number | null; progress: number; steps: ReadingStep[] }
  | { kind: "errors"; fileName: string; issues: Issue[] }
  | { kind: "preview"; fileName: string; parse: ParseResult };

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ImportFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const clientId = params.get("cliente");
  const [phase, setPhase] = useState<Phase>({ kind: "start", error: null });
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [matches, setMatches] = useState<Map<string, MatchResult>>(new Map());
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});

  async function handleFile(file: File) {
    const check = checkImportFile(file);
    if (!check.ok) return setPhase({ kind: "start", error: check.error });

    const steps: ReadingStep[] = [
      { label: "Leyendo el archivo", state: "running" },
      { label: "Columnas", state: "pending" },
      { label: "Días y bloques", state: "pending" },
      { label: "Buscando ejercicios en la biblioteca…", state: "pending" },
      { label: "Armando la vista previa", state: "pending" },
    ];
    const show = (patch: Partial<Extract<Phase, { kind: "reading" }>>) =>
      setPhase((p) => (p.kind === "reading" ? { ...p, ...patch, steps: [...(patch.steps ?? p.steps)] } : p));
    setPhase({ kind: "reading", file, rows: null, progress: 0, steps });

    try {
      // 1) Archivo (progreso real de lectura)
      const buf = await readFile(file, (f) => show({ progress: f * 0.4 }));
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      const sheets = workbookToSheets(buf, isCsv);
      const nonEmpty = sheets.reduce((n, sh) => n + sh.rows.filter((r) => r.some((c) => String(c ?? "").trim())).length, 0);
      steps[0] = { label: "Archivo leído", state: "done" };
      show({ progress: 0.45, rows: nonEmpty, steps });
      await pause(250);

      // 2) Columnas
      const parse = parseWorkbook(sheets);
      const recognized = parse.columns.recognized.length;
      steps[1] =
        parse.format === "bloques"
          ? { label: `Formato por bloques · ${sheets.length} ${sheets.length === 1 ? "hoja" : "hojas"}`, state: "done" }
          : { label: `Columnas reconocidas (${recognized} de ${FIELD_COUNT})`, state: parse.columns.missingRequired.length ? "failed" : "done" };
      show({ progress: 0.6, steps });
      await pause(300);

      // 3) Días y bloques
      const blocks = new Set(parse.days.flatMap((d) => d.blocks.map((b) => b.name))).size;
      steps[2] = {
        label: `${parse.days.length} ${parse.days.length === 1 ? "día" : "días"} · ${blocks} ${blocks === 1 ? "bloque detectado" : "bloques detectados"}`,
        state: parse.ok ? "done" : parse.rows.length ? "done" : "failed",
      };
      show({ progress: 0.7, steps });
      await pause(300);

      if (!parse.ok) {
        setPhase({ kind: "errors", fileName: file.name, issues: [...parse.errors, ...parse.warnings] });
        return;
      }

      // 4) Matching contra la biblioteca
      steps[3] = { label: "Buscando ejercicios en la biblioteca…", state: "running" };
      show({ steps });
      const lib = await data.exercises.list();
      const match = buildMatcher(lib);
      const m = new Map<string, MatchResult>();
      for (const r of parse.rows) {
        const key = normalizeText(r.exercise);
        if (!m.has(key)) m.set(key, match(r.exercise));
      }
      const found = [...m.values()].filter((x) => x.status === "ok").length;
      steps[3] = { label: `Ejercicios buscados (${found} de ${m.size} reconocidos)`, state: "done" };
      show({ progress: 0.9, steps });
      await pause(300);

      // 5) Vista previa
      steps[4] = { label: "Vista previa lista", state: "done" };
      show({ progress: 1, steps });
      await pause(250);

      setExercises(lib);
      setMatches(m);
      setResolutions({});
      setPhase({ kind: "preview", fileName: file.name, parse });
    } catch {
      setPhase({
        kind: "errors",
        fileName: file.name,
        issues: [{ kind: "error", title: "El archivo no se pudo abrir", detail: "Puede estar dañado o protegido con contraseña. Guardalo de nuevo como .xlsx o usá la plantilla." }],
      });
    }
  }

  const resolve = (raw: string, r: Resolution) => setResolutions((prev) => ({ ...prev, [normalizeText(raw)]: r }));

  async function onLink(raw: string, ex: Exercise) {
    // Vincular guarda el texto original como alias: la próxima vez se reconoce solo.
    const updated = await data.exercises.addAlias(ex.id, raw).catch(() => ex);
    setExercises((list) => list.map((e) => (e.id === updated.id ? updated : e)));
    resolve(raw, { exerciseId: ex.id });
  }

  async function onCreate(raw: string, name: string, category: ExerciseCategory) {
    const created = await data.exercises.create({
      name,
      aliases: normalizeText(raw) !== normalizeText(name) ? [raw] : [],
      category,
      muscleGroups: [],
      equipment: null,
      videoPath: null,
      videoPosterPath: null,
      videoDurationS: null,
      youtubeUrl: null,
      techniqueCues: [],
      commonMistakes: [],
    });
    setExercises((list) => [...list, created]);
    resolve(raw, { exerciseId: created.id });
  }

  function onContinue() {
    if (phase.kind !== "preview") return;
    const byId = new Map(exercises.map((e) => [e.id, e]));
    const draft = importToDraft(
      phase.parse.days,
      (row) => {
        const s = rowState(row, matches, resolutions, byId);
        return s.exercise ? { exerciseId: s.exercise.id, name: s.exercise.name } : { exerciseId: null, name: row.exercise };
      },
      { fileName: phase.fileName, clientIds: clientId ? [clientId] : [], name: phase.parse.suggestedName },
    );
    saveDraft(draft);
    router.push("/coach/rutinas/nueva/manual?paso=3");
  }

  const back = () => {
    if (phase.kind === "start") router.push(`/coach/rutinas/nueva${clientId ? `?cliente=${clientId}` : ""}`);
    else setPhase({ kind: "start", error: null });
  };

  return (
    <div>
      {phase.kind === "start" && (
        <>
          <WizardHeader step={1} kicker="Importar Excel · Paso 1 de 3" onBack={back} showSteps={false} />
          <ImportStart onFile={(f) => void handleFile(f)} error={phase.error} />
        </>
      )}
      {phase.kind === "reading" && (
        <>
          <WizardHeader step={2} kicker="Importar Excel · Paso 2 de 3" onBack={back} showSteps={false} />
          <ImportReading
            fileName={phase.file.name}
            sizeKb={Math.max(1, Math.round(phase.file.size / 1024))}
            rows={phase.rows}
            progress={phase.progress}
            steps={phase.steps}
          />
        </>
      )}
      {phase.kind === "errors" && (
        <>
          <WizardHeader step={2} kicker="Importar Excel" onBack={back} showSteps={false} />
          <ImportErrors fileName={phase.fileName} issues={phase.issues} onRetry={() => setPhase({ kind: "start", error: null })} />
        </>
      )}
      {phase.kind === "preview" && (
        <>
          <WizardHeader step={2} kicker="Importar Excel · Paso 2 de 3" subtitle={phase.fileName} onBack={back} showSteps={false} />
          <ImportPreview
            parse={phase.parse}
            matches={matches}
            resolutions={resolutions}
            exercises={exercises}
            onLink={onLink}
            onLeave={(raw) => resolve(raw, { exerciseId: null })}
            onCreate={onCreate}
            onContinue={onContinue}
          />
        </>
      )}
    </div>
  );
}
