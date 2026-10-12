// Metadatos y miniatura del video, en el navegador (<video> + canvas).

export type VideoProbe = {
  durationS: number;
  width: number;
  height: number;
  /** Frame a 1 s como JPEG. null si el navegador no pudo decodificar (ej. HEVC en Chrome). */
  poster: Blob | null;
};

function once(el: HTMLMediaElement, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${event}`)), timeoutMs);
    el.addEventListener(
      event,
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    el.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error("No se pudo leer el video"));
      },
      { once: true },
    );
  });
}

export async function probeVideo(file: Blob, atSeconds = 1, maxWidth = 540): Promise<VideoProbe> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await once(video, "loadedmetadata", 15_000);
    let durationS = Number.isFinite(video.duration) ? video.duration : 0;
    if (!Number.isFinite(video.duration)) {
      // WebM grabados con MediaRecorder no traen duración: forzamos a que la calcule.
      try {
        video.currentTime = 1e7;
        await once(video, "durationchange", 5_000);
        durationS = Number.isFinite(video.duration) ? video.duration : 0;
      } catch {
        durationS = 0;
      }
    }
    const width = video.videoWidth;
    const height = video.videoHeight;

    let poster: Blob | null = null;
    if (width && height) {
      try {
        video.currentTime = Math.min(atSeconds, Math.max(0, durationS - 0.1));
        await once(video, "seeked", 10_000);
        const scale = Math.min(1, maxWidth / width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
        poster = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
      } catch {
        poster = null;
      }
    }
    return { durationS, width, height, poster };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
