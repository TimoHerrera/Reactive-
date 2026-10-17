// @vitest-environment happy-dom
// Avisos: cada profe ve y cambia solo lo suyo; «todo el centro» es solo para admin; el paciente no entra
// (mismas reglas que RLS en 0012_avisos.sql).
import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "@/lib/data/seed";
import { defaultPrefs } from "@/lib/notify/alerts";
import { mockDataSource as data } from "./index";
import { resetMockDb } from "./store";

const as = async (email: string) => {
  await data.auth.signOut();
  expect(await data.auth.signIn(email, DEMO_PASSWORD)).toMatchObject({ ok: true });
};

beforeEach(async () => {
  await data.auth.signOut();
  resetMockDb();
});

describe("avisos del profe", () => {
  it("de fábrica hasta que guarda; lo de un profe no le cambia nada al otro", async () => {
    await as("nico@reactive.test");
    expect(await data.notifications.getPrefs()).toEqual(defaultPrefs("coach"));
    const { updatedAt, ...input } = defaultPrefs("coach");
    void updatedAt;
    await data.notifications.savePrefs({ ...input, dueSoonDays: 10, overdueRepeatDays: null });
    await data.notifications.markSeen(["vence:x:2026-10-20", "vence:x:2026-10-20"]);
    expect(await data.notifications.getPrefs()).toMatchObject({ dueSoonDays: 10, overdueRepeatDays: null });
    expect(await data.notifications.listSeen()).toEqual(["vence:x:2026-10-20"]);

    await as("caro@reactive.test");
    expect((await data.notifications.getPrefs()).dueSoonDays).toBe(3);
    expect(await data.notifications.listSeen()).toEqual([]);
  });

  it("un profe no puede pedir los avisos de todo el centro; el admin sí", async () => {
    const { updatedAt, ...input } = defaultPrefs("coach");
    void updatedAt;
    await as("nico@reactive.test");
    expect((await data.notifications.savePrefs({ ...input, scope: "all" })).scope).toBe("mine");
    await as("admin@reactive.test");
    expect((await data.notifications.getPrefs()).scope).toBe("all");
    expect((await data.notifications.savePrefs({ ...input, scope: "all" })).scope).toBe("all");
  });

  it("valida los números y el paciente no tiene avisos", async () => {
    const { updatedAt, ...input } = defaultPrefs("coach");
    void updatedAt;
    await as("nico@reactive.test");
    await expect(data.notifications.savePrefs({ ...input, dueSoonDays: 0 })).rejects.toThrow(/1 a 60/);
    await as("martina@reactive.test");
    await expect(data.notifications.getPrefs()).rejects.toThrow(/Solo profes/);
  });
});
