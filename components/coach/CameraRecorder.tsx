"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MAX_VIDEO_SECONDS } from "@/lib/video/validate";
import {
  cameraProblem,
  detectDevice,
  ENABLE_STEPS,
  pickRecorderMime,
  PROBLEM_MESSAGES,
  recordingClock,
  recordingFile,
  type CameraProblem,
  type Device,
} from "@/lib/video/recorder";

type Facing = "environment" | "user";
type State =
  | { kind: "intro" }
  | { kind: "starting" }
  | { kind: "live" }
  | { kind: "recording"; startedAt: number }
  | { kind: "review"; file: File; url: string }
  | { kind: "problem"; problem: CameraProblem };

/**
 * Grabar con la cámara desde la página (PC y celular). Pide permiso con «Habilitar cámara», muestra la
 * imagen en vivo, graba hasta MAX_VIDEO_SECONDS y devuelve el archivo al mismo flujo que «Subir video».
 * Si la cámara está bloqueada, explica cómo habilitarla según el dispositivo.
 */
export function CameraRecorder({
  onDone,
  onClose,
  onNativeCamera,
  onPickFile,
}: {
  onDone: (file: File) => void;
  onClose: () => void;
  /** Celular: abrir la app de cámara del teléfono (input con capture). */
  onNativeCamera: () => void;
  /** Elegir un archivo ya grabado. */
  onPickFile: () => void;
}) {
  const [state, setState] = useState<State>({ kind: "intro" });
  const [facing, setFacing] = useState<Facing>("environment");
  const [canFlip, setCanFlip] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [device, setDevice] = useState<Device>("pc");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const reviewUrlRef = useRef<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(
    async (want: Facing) => {
      if (typeof window === "undefined") return;
      if (!window.isSecureContext) return setState({ kind: "problem", problem: "insecure" });
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        return setState({ kind: "problem", problem: "unsupported" });
      }
      setState({ kind: "starting" });
      stopStream();
      const video: MediaTrackConstraints = { facingMode: { ideal: want }, width: { ideal: 720 }, height: { ideal: 1280 } };
      let stream: MediaStream;
      try {
        // Con sonido (para las indicaciones del profe). Este pedido es el que muestra el permiso del navegador.
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      } catch (err) {
        const p = cameraProblem(err);
        if (p !== "no-camera") return setState({ kind: "problem", problem: p });
        try {
          // Puede faltar el micrófono (PC sin mic): grabamos sin sonido.
          stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        } catch (err2) {
          return setState({ kind: "problem", problem: cameraProblem(err2) });
        }
      }
      streamRef.current = stream;
      setFacing(want);
      navigator.mediaDevices
        .enumerateDevices()
        .then((list) => setCanFlip(list.filter((d) => d.kind === "videoinput").length > 1))
        .catch(() => setCanFlip(false));
      setState({ kind: "live" });
    },
    [stopStream],
  );

  // Dispositivo (para las instrucciones) y, si el permiso ya está dado o bloqueado, no hace falta el paso intro.
  useEffect(() => {
    setDevice(detectDevice(navigator.userAgent));
    let alive = true;
    navigator.permissions
      ?.query({ name: "camera" as PermissionName })
      .then((s) => {
        if (!alive) return;
        if (s.state === "granted") void start("environment");
        else if (s.state === "denied") setState({ kind: "problem", problem: "denied" });
      })
      .catch(() => undefined); // Safari/Firefox: no informan, se pregunta al tocar «Habilitar cámara»
    return () => {
      alive = false;
    };
  }, [start]);

  // La imagen en vivo.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || (state.kind !== "live" && state.kind !== "recording")) return;
    if (v.srcObject !== streamRef.current) {
      v.srcObject = streamRef.current;
      void v.play().catch(() => undefined);
    }
  }, [state.kind]);

  // Reloj y corte automático al máximo permitido.
  useEffect(() => {
    if (state.kind !== "recording") return;
    const id = setInterval(() => {
      const s = (Date.now() - state.startedAt) / 1000;
      setElapsed(s);
      if (s >= MAX_VIDEO_SECONDS) recorderRef.current?.stop();
    }, 200);
    return () => clearInterval(id);
  }, [state]);

  // Al cerrar: apagar la cámara y liberar la vista previa.
  useEffect(
    () => () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopStream();
      if (reviewUrlRef.current) URL.revokeObjectURL(reviewUrlRef.current);
    },
    [stopStream],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function record() {
    const stream = streamRef.current;
    if (!stream) return;
    const mime = pickRecorderMime((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const file = recordingFile(chunksRef.current, rec.mimeType || mime);
      stopStream(); // se apaga la cámara mientras revisás la toma
      if (reviewUrlRef.current) URL.revokeObjectURL(reviewUrlRef.current);
      const url = URL.createObjectURL(file);
      reviewUrlRef.current = url;
      setState({ kind: "review", file, url });
    };
    recorderRef.current = rec;
    rec.start(500);
    setElapsed(0);
    setState({ kind: "recording", startedAt: Date.now() });
  }

  const mobile = device !== "pc";
  const live = state.kind === "live" || state.kind === "recording";
  const btn = "flex h-12 w-full items-center justify-center rounded-full text-body font-bold";

  // Portal al body: así tapa toda la pantalla aunque algún contenedor de la página tenga transform o scroll propio.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Grabar video" className="fixed inset-0 z-[60] flex flex-col bg-black text-ink">
      <div className="flex items-center justify-between px-gutter pb-2 pt-4">
        <p className="label text-ink">Grabar video</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-[1.25rem] hover:bg-white/20"
        >
          ✕
        </button>
      </div>

      <div className="relative mx-auto flex min-h-0 w-full max-w-[480px] flex-1 items-center justify-center px-gutter">
        {live && (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              aria-label="Imagen de la cámara"
              className="aspect-[9/16] max-h-full w-full rounded-lg bg-black object-cover"
              style={facing === "user" ? { transform: "scaleX(-1)" } : undefined}
            />
            {state.kind === "recording" && (
              <p
                className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-danger px-3 py-1 text-small font-bold text-ink"
                role="timer"
                aria-live="off"
              >
                ● {recordingClock(elapsed, MAX_VIDEO_SECONDS)}
              </p>
            )}
          </>
        )}

        {state.kind === "review" && (
          <video
            src={state.url}
            controls
            playsInline
            autoPlay
            loop
            aria-label="Video grabado"
            className="aspect-[9/16] max-h-full w-full rounded-lg bg-black object-cover"
          />
        )}

        {(state.kind === "intro" || state.kind === "starting") && (
          <div className="max-w-[20rem] text-center">
            <p className="display text-h1">Usá la cámara</p>
            <p className="mt-3 text-body text-title">
              Para grabar desde acá, {mobile ? "el celular" : "el navegador"} te va a pedir permiso para usar la cámara (y el micrófono,
              para que se escuchen tus indicaciones). Tocá <strong>«Permitir»</strong>.
            </p>
          </div>
        )}

        {state.kind === "problem" && (
          <div className="max-w-[22rem]" role="alert">
            <p className="display text-h1">Cámara no disponible</p>
            <p className="mt-3 text-body text-title">{PROBLEM_MESSAGES[state.problem]}</p>
            {state.problem === "denied" && (
              <>
                <p className="label mt-5">Cómo habilitarla</p>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-small text-title">
                  {ENABLE_STEPS[device].map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-[480px] space-y-2 px-gutter pb-8 pt-4">
        {(state.kind === "intro" || state.kind === "starting") && (
          <button type="button" disabled={state.kind === "starting"} onClick={() => void start(facing)} className={`${btn} bg-accent disabled:opacity-60`}>
            {state.kind === "starting" ? "Esperando permiso…" : "Habilitar cámara"}
          </button>
        )}

        {state.kind === "live" && (
          <div className="flex items-center justify-center gap-6">
            {canFlip ? (
              <button
                type="button"
                onClick={() => void start(facing === "environment" ? "user" : "environment")}
                aria-label="Cambiar de cámara"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                  <path d="M9 13a3 3 0 0 0 5.2 2M15 13a3 3 0 0 0-5.2-2" />
                </svg>
              </button>
            ) : (
              <span className="h-12 w-12" />
            )}
            <button
              type="button"
              onClick={record}
              aria-label="Empezar a grabar"
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-ink"
            >
              <span className="h-14 w-14 rounded-full bg-danger" />
            </button>
            <span className="h-12 w-12" />
          </div>
        )}

        {state.kind === "recording" && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => recorderRef.current?.stop()}
              aria-label="Detener grabación"
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-ink"
            >
              <span className="h-7 w-7 rounded-sm bg-danger" />
            </button>
          </div>
        )}

        {state.kind === "review" && (
          <>
            <button type="button" onClick={() => onDone(state.file)} className={`${btn} bg-accent`}>
              Usar este video
            </button>
            <button type="button" onClick={() => void start(facing)} className={`${btn} border border-white/30`}>
              Volver a grabar
            </button>
          </>
        )}

        {state.kind === "problem" && (
          <>
            {(state.problem === "denied" || state.problem === "busy" || state.problem === "unknown") && (
              <button type="button" onClick={() => void start(facing)} className={`${btn} bg-accent`}>
                Habilitar cámara
              </button>
            )}
            {mobile && (
              <button type="button" onClick={onNativeCamera} className={`${btn} border border-white/30`}>
                Usar la app de cámara del celular
              </button>
            )}
            <button type="button" onClick={onPickFile} className={`${btn} border border-white/30`}>
              Elegir un video ya grabado
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
