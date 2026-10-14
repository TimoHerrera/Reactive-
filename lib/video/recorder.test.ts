import { describe, expect, it } from "vitest";
import { checkVideoFile } from "./validate";
import { baseMime, cameraProblem, detectDevice, pickRecorderMime, recordingClock, recordingFile } from "./recorder";

describe("grabar con la cámara", () => {
  it("elige el primer formato soportado (Safari → mp4, Chrome → webm)", () => {
    expect(pickRecorderMime((t) => t.startsWith("video/mp4"))).toBe("video/mp4;codecs=avc1,mp4a");
    expect(pickRecorderMime((t) => t === "video/webm;codecs=vp8,opus" || t === "video/webm")).toBe("video/webm;codecs=vp8,opus");
    expect(pickRecorderMime(() => false)).toBe("");
    expect(
      pickRecorderMime(() => {
        throw new Error("x");
      }),
    ).toBe("");
  });

  it("el archivo grabado pasa la misma validación que «Subir video»", () => {
    const f = recordingFile([new Blob(["x"])], "video/webm;codecs=vp9,opus", new Date("2026-10-14T13:05:09Z"));
    expect(f.name).toBe("grabacion-20261014130509.webm");
    expect(f.type).toBe("video/webm");
    expect(checkVideoFile(f).ok).toBe(true);
    expect(recordingFile([], "video/mp4;codecs=avc1").name).toMatch(/\.mp4$/);
    expect(baseMime("")).toBe("video/webm");
  });

  it("traduce los errores del permiso", () => {
    expect(cameraProblem({ name: "NotAllowedError" })).toBe("denied");
    expect(cameraProblem({ name: "NotFoundError" })).toBe("no-camera");
    expect(cameraProblem({ name: "NotReadableError" })).toBe("busy");
    expect(cameraProblem({ name: "NotSupportedError" })).toBe("unsupported");
    expect(cameraProblem(new Error("?"))).toBe("unknown");
  });

  it("detecta el dispositivo para explicar cómo habilitar la cámara", () => {
    expect(detectDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("iphone");
    expect(detectDevice("Mozilla/5.0 (Linux; Android 14; Pixel 7)")).toBe("android");
    expect(detectDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("pc");
  });

  it("reloj de grabación", () => {
    expect(recordingClock(7.4, 60)).toBe("0:07 / 1:00");
    expect(recordingClock(75, 60)).toBe("1:00 / 1:00");
  });
});
