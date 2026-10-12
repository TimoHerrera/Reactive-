"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AliasInput } from "@/components/coach/AliasInput";
import { VideoUploader, type UploadedVideo } from "@/components/coach/VideoUploader";
import { Input, PillButton } from "@/components/ui";
import { IconX } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { data, EXERCISE_CATEGORIES, MUSCLE_GROUPS, type Exercise, type ExerciseCategory } from "@/lib/data";
import type { ExerciseInput } from "@/lib/data/repositories";
import { isValidYouTubeUrl } from "@/lib/video/youtube";

const EMPTY: ExerciseInput = {
  name: "",
  aliases: [],
  category: "Fuerza",
  muscleGroups: [],
  equipment: null,
  videoPath: null,
  videoPosterPath: null,
  videoDurationS: null,
  youtubeUrl: null,
  techniqueCues: [],
  commonMistakes: [],
};

function toInput(e: Exercise): ExerciseInput {
  return {
    name: e.name,
    aliases: e.aliases,
    category: e.category,
    muscleGroups: e.muscleGroups,
    equipment: e.equipment,
    videoPath: e.videoPath,
    videoPosterPath: e.videoPosterPath,
    videoDurationS: e.videoDurationS,
    youtubeUrl: e.youtubeUrl,
    techniqueCues: e.techniqueCues,
    commonMistakes: e.commonMistakes,
  };
}

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label mb-2 block">
        {label}
      </label>
      {children}
      {hint && <div className="mt-2 text-small">{hint}</div>}
    </div>
  );
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/**
 * Alta y edición de ejercicio.
 * Edición: autoguardado («Guardado HH:MM»); Cancelar deshace los cambios de esta sesión.
 */
export function ExerciseForm({ exercise }: { exercise?: Exercise }) {
  const router = useRouter();
  const editing = !!exercise;
  // Foto del estado inicial: el autoguardado actualiza `exercise` pero «Cancelar» vuelve a esto.
  const [original] = useState<ExerciseInput>(() => (exercise ? toInput(exercise) : EMPTY));
  const [draft, setDraft] = useState<ExerciseInput>(original);
  const [cuesText, setCuesText] = useState(original.techniqueCues.join("\n"));
  const [mistakesText, setMistakesText] = useState(original.commonMistakes.join("\n"));
  const [youtube, setYoutube] = useState(original.youtubeUrl ?? "");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Videos subidos en esta sesión (para limpiar si se cancela) y reemplazados (para borrar al guardar).
  const uploadedRef = useRef<string[]>([]);
  const replacedRef = useRef<string[]>([]);

  const youtubeValid = !youtube.trim() || isValidYouTubeUrl(youtube);
  const nameError = !draft.name.trim() ? "Poné un nombre." : null;

  const current: ExerciseInput = useMemo(
    () => ({
      ...draft,
      name: draft.name.trim(),
      equipment: draft.equipment?.trim() || null,
      techniqueCues: lines(cuesText),
      commonMistakes: lines(mistakesText),
      youtubeUrl: youtube.trim() && youtubeValid ? youtube.trim() : youtube.trim() ? draft.youtubeUrl : null,
    }),
    [draft, cuesText, mistakesText, youtube, youtubeValid],
  );

  // Autoguardado (solo edición). Depende solo del borrador: si `exercise` se recarga
  // (otra pestaña, el propio guardado) no vuelve a disparar ni pisa un «Cancelar».
  const exerciseId = exercise?.id;
  const firstRun = useRef(true);
  const closingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!exerciseId) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (nameError || closingRef.current) return;
    timerRef.current = setTimeout(async () => {
      if (closingRef.current) return;
      setSaving(true);
      try {
        await data.exercises.update(exerciseId, current);
        setSavedAt(new Date());
        setError(null);
      } catch (e) {
        setError((e as Error).message.includes("duplicate") ? "Ya existe un ejercicio con ese nombre." : (e as Error).message);
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, exerciseId, nameError]);

  /** Corta el autoguardado antes de cerrar (guardar, cancelar o eliminar). */
  const stopAutosave = () => {
    closingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const set = <K extends keyof ExerciseInput>(k: K, v: ExerciseInput[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const setVideo = (v: UploadedVideo | null) => {
    if (draft.videoPath) replacedRef.current.push(draft.videoPath);
    if (draft.videoPosterPath) replacedRef.current.push(draft.videoPosterPath);
    if (v) uploadedRef.current.push(v.videoPath, ...(v.videoPosterPath ? [v.videoPosterPath] : []));
    setDraft((d) => ({
      ...d,
      videoPath: v?.videoPath ?? null,
      videoPosterPath: v?.videoPosterPath ?? null,
      videoDurationS: v?.videoDurationS ?? null,
    }));
  };

  const cleanup = (paths: string[], keep: (string | null)[]) =>
    Promise.all(paths.filter((p) => !keep.includes(p)).map((p) => data.videos.remove(p).catch(() => undefined)));

  async function onSave() {
    if (nameError || !youtubeValid) {
      setError(nameError ?? "Revisá el link de YouTube.");
      return;
    }
    setSaving(true);
    stopAutosave();
    try {
      if (editing) await data.exercises.update(exercise!.id, current);
      else await data.exercises.create(current);
      await cleanup(replacedRef.current, [current.videoPath, current.videoPosterPath]);
      router.push("/coach/ejercicios");
    } catch (e) {
      setError((e as Error).message.includes("duplicate") ? "Ya existe un ejercicio con ese nombre." : (e as Error).message);
      setSaving(false);
      closingRef.current = false;
    }
  }

  async function onCancel() {
    stopAutosave();
    if (editing) await data.exercises.update(exercise!.id, original).catch(() => undefined);
    await cleanup(uploadedRef.current, [original.videoPath, original.videoPosterPath]);
    router.push("/coach/ejercicios");
  }

  async function onDelete() {
    if (!exercise || !window.confirm(`¿Eliminar «${exercise.name}»? Las rutinas que lo usan lo van a mostrar sin video.`)) return;
    stopAutosave();
    await data.exercises.remove(exercise.id);
    await cleanup([...uploadedRef.current, original.videoPath, original.videoPosterPath].filter(Boolean) as string[], []);
    router.push("/coach/ejercicios");
  }

  return (
    <div className="pb-32">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/95 px-gutter py-4 backdrop-blur">
        <button
          type="button"
          onClick={() => void onCancel()}
          aria-label="Cerrar sin guardar"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[1.5rem] hover:bg-surface-2"
        >
          <IconX />
        </button>
        <h1 className="display flex-1 text-[1.75rem]">{editing ? "Editar ejercicio" : "Nuevo ejercicio"}</h1>
        {editing && (
          <p className="text-small text-muted" aria-live="polite">
            {saving ? "Guardando…" : savedAt ? `Guardado ${hhmm(savedAt)}` : ""}
          </p>
        )}
      </header>

      <div className="space-y-6 px-gutter pt-5">
        <Input
          label="Nombre"
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          error={draft.name !== original.name && nameError ? nameError : undefined}
          autoFocus={!editing}
        />

        <AliasInput value={draft.aliases} onChange={(v) => set("aliases", v)} name={draft.name} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría" htmlFor="category">
            <select
              id="category"
              value={draft.category}
              onChange={(e) => set("category", e.target.value as ExerciseCategory)}
              className="h-12 w-full appearance-none rounded-md border border-line bg-surface bg-[length:12px] bg-[right_16px_center] bg-no-repeat px-4 text-body font-medium text-ink outline-none focus:border-accent"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='white' stroke-width='2' fill='none'/%3E%3C/svg%3E\")",
              }}
            >
              {EXERCISE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Input
            label="Equipamiento"
            value={draft.equipment ?? ""}
            onChange={(e) => set("equipment", e.target.value)}
            placeholder="Banda, colchoneta"
          />
        </div>

        <fieldset>
          <legend className="label mb-2">Grupo muscular</legend>
          <div className="flex flex-wrap gap-2">
            {MUSCLE_GROUPS.map((m) => {
              const on = draft.muscleGroups.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("muscleGroups", on ? draft.muscleGroups.filter((x) => x !== m) : [...draft.muscleGroups, m])}
                  className={cn(
                    "h-11 rounded-full px-4 text-small font-semibold transition-colors",
                    on ? "bg-accent text-ink" : "border border-line text-title hover:bg-surface-2",
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </fieldset>

        <section aria-labelledby="video-label" className="space-y-4">
          <p id="video-label" className="label">
            Video
          </p>
          <VideoUploader
            value={
              draft.videoPath
                ? { videoPath: draft.videoPath, videoPosterPath: draft.videoPosterPath, videoDurationS: draft.videoDurationS }
                : null
            }
            onUploaded={(v) => setVideo(v)}
            onRemove={() => setVideo(null)}
          />
          <Input
            label="Link de YouTube (opcional)"
            type="url"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={youtube}
            onChange={(e) => setYoutube(e.target.value)}
            error={youtube.trim() && !youtubeValid ? "No parece un link de YouTube válido." : undefined}
            hint={youtube.trim() && youtubeValid ? "✓ Link válido" : "Complementa al video subido. Si no hay video, se muestra este."}
          />
        </section>

        <Field label="Claves técnicas" htmlFor="cues" hint={<span className="text-muted">Una por línea.</span>}>
          <textarea
            id="cues"
            rows={4}
            value={cuesText}
            onChange={(e) => setCuesText(e.target.value)}
            placeholder={"Mancuerna pegada al pecho, codos hacia abajo.\nBajá en 3 segundos…"}
            className="w-full rounded-md border border-line bg-surface px-4 py-3 text-body text-ink outline-none placeholder:text-muted/70 focus:border-accent"
          />
        </Field>

        <Field label="Errores comunes" htmlFor="mistakes" hint={<span className="text-muted">Una por línea. Salen como «No hagas esto».</span>}>
          <textarea
            id="mistakes"
            rows={3}
            value={mistakesText}
            onChange={(e) => setMistakesText(e.target.value)}
            placeholder={"Rodillas que se van hacia adentro.\nLevantar los talones al bajar."}
            className="w-full rounded-md border border-line bg-surface px-4 py-3 text-body text-ink outline-none placeholder:text-muted/70 focus:border-accent"
          />
        </Field>

        {editing && (
          <button
            type="button"
            onClick={() => void onDelete()}
            className="h-11 text-small font-semibold text-danger-ink underline underline-offset-4"
          >
            Eliminar ejercicio
          </button>
        )}

        {error && (
          <p role="alert" className="text-small font-medium text-danger-ink">
            ✕ {error}
          </p>
        )}
      </div>

      <footer className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-phone -translate-x-1/2 gap-3 border-t border-line bg-bg/95 px-gutter pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <button
          type="button"
          onClick={() => void onCancel()}
          className="h-12 flex-[0_0_38%] rounded-full border-2 border-line text-body font-semibold text-ink hover:bg-surface-2"
        >
          Cancelar
        </button>
        <PillButton size="md" arrow className="flex-1" onClick={() => void onSave()} disabled={saving && !editing}>
          Guardar
        </PillButton>
      </footer>
    </div>
  );
}
