import { describe, expect, it } from "vitest";
import { checkVideoDuration, checkVideoFile, videoMimeType } from "./validate";

const MB = 1024 * 1024;

describe("checkVideoFile", () => {
  it("acepta mp4, mov y webm dentro del límite", () => {
    expect(checkVideoFile({ name: "a.mp4", type: "video/mp4", size: 10 * MB }, 50).ok).toBe(true);
    expect(checkVideoFile({ name: "a.mov", type: "video/quicktime", size: 10 * MB }, 50).ok).toBe(true);
    expect(checkVideoFile({ name: "a.webm", type: "video/webm", size: 10 * MB }, 50).ok).toBe(true);
  });

  it("deduce el tipo por extensión si viene vacío", () => {
    expect(videoMimeType({ name: "IMG_1234.MOV", type: "" })).toBe("video/quicktime");
    expect(checkVideoFile({ name: "clip.mp4", type: "", size: MB }, 50).ok).toBe(true);
  });

  it("rechaza otros formatos", () => {
    const r = checkVideoFile({ name: "a.avi", type: "video/x-msvideo", size: MB }, 50);
    expect(r).toEqual({ ok: false, error: expect.stringContaining(".mp4, .mov o .webm") });
  });

  it("rechaza archivos grandes y explica cómo achicarlos", () => {
    const r = checkVideoFile({ name: "a.mp4", type: "video/mp4", size: 80 * MB }, 50);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("80 MB");
      expect(r.error).toContain("50 MB");
      expect(r.error).toContain("720p");
    }
  });
});

describe("checkVideoDuration", () => {
  it("valida la duración máxima", () => {
    expect(checkVideoDuration(45, 60).ok).toBe(true);
    expect(checkVideoDuration(60.3, 60).ok).toBe(true);
    expect(checkVideoDuration(75, 60).ok).toBe(false);
  });
  it("no bloquea si no se pudo leer", () => {
    expect(checkVideoDuration(NaN, 60).ok).toBe(true);
  });
});
