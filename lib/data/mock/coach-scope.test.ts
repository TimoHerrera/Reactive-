// @vitest-environment happy-dom
// Cada profe ve solo lo suyo (mismas reglas que RLS en 0007_coach_scope.sql). Seed: Nico tiene 8 clientes,
// Caro tiene a Bruno; las plantillas y los ejercicios son compartidos.
import { beforeEach, describe, expect, it } from "vitest";
import { publishDraft } from "@/lib/routine/publish";
import { emptyDraft } from "@/lib/routine/draft";
import { DEMO_PASSWORD, IDS } from "@/lib/data/seed";
import type { RoutineTree } from "../types";
import { mockDataSource as data } from "./index";
import { getDb, resetMockDb } from "./store";

const as = async (email: string) => {
  await data.auth.signOut();
  expect(await data.auth.signIn(email, DEMO_PASSWORD)).toMatchObject({ ok: true });
};
const NICO = "nico@reactive.test";
const CARO = "caro@reactive.test";
const ADMIN = "admin@reactive.test";
const routineOf = (clientId: string) => getDb().routines.find((r) => r.clientId === clientId)!;
const template = () => getDb().routines.find((r) => r.isTemplate)!;
const tree = (p: Partial<RoutineTree>): RoutineTree => ({
  id: "",
  name: "Prueba",
  clientId: null,
  isTemplate: false,
  sourceTemplateId: null,
  startsOn: "2026-10-13",
  endsOn: "2026-11-10",
  daysPerWeek: 1,
  clientMessage: null,
  createdBy: null,
  updatedBy: null,
  updatedAt: null,
  publishedAt: "2026-10-13T00:00:00Z",
  createdAt: "",
  days: [{ id: "", routineId: "", label: "A", title: "Fuerza", position: 0, blocks: [] }],
  ...p,
});

beforeEach(async () => {
  window.localStorage.clear();
  resetMockDb();
  await data.auth.signOut();
});

describe("autor de la rutina", () => {
  it("created_by es siempre el usuario logueado, aunque el formulario mande otro", async () => {
    await as(CARO);
    const saved = await data.routines.saveTree(tree({ clientId: IDS.bruno, createdBy: IDS.nico }));
    expect(saved).toMatchObject({ createdBy: IDS.caro, updatedBy: null });
  });

  it("publicar desde el wizard: Nico carga → «Cargada por Nico»; el admin edita → «editada por Admin»", async () => {
    await as(NICO);
    const draft = { ...emptyDraft(), name: "Rutina de Nico", clientIds: [IDS.lucas] };
    draft.days[0]!.blocks[0]!.items.push({ key: "x", exerciseId: null, rawName: "Plancha", sets: 3, reps: "30 s", load: "", rest: "", tempo: "", rpeTarget: "", rirTarget: "", notes: "" });
    const { routineIds } = await publishDraft(draft, { clientIds: [IDS.lucas], saveAsTemplate: false });
    const id = routineIds[0]!.routineId;
    expect(getDb().routines.find((r) => r.id === id)).toMatchObject({ createdBy: IDS.nico, updatedBy: null });

    await as(ADMIN);
    await publishDraft({ ...draft, routineId: id, name: "Rutina de Nico (v2)" }, { clientIds: [IDS.lucas], saveAsTemplate: false });
    expect(getDb().routines.find((r) => r.id === id)).toMatchObject({ createdBy: IDS.nico, updatedBy: IDS.admin });
  });
});

describe("cada profe ve solo lo suyo", () => {
  it("clientes, rutinas, sesiones, vistas y observaciones", async () => {
    await as(CARO);
    expect((await data.profiles.listClients()).map((c) => c.fullName)).toEqual(["Bruno S."]);
    expect(await data.profiles.get(IDS.martina)).toBeNull();
    expect(await data.routines.listForClient(IDS.martina)).toEqual([]);
    expect(await data.routines.getTree(routineOf(IDS.martina).id)).toBeNull();
    expect(await data.sessions.list()).toEqual([]);
    expect(await data.views.list()).toEqual([]);
    expect(await data.coachNotes.listForClient(IDS.martina)).toEqual([]);
    await expect(data.coachNotes.add(IDS.martina, "x")).rejects.toThrow(/No tenés acceso/);
    const names = (await data.routines.list()).map((r) => r.name).sort();
    expect(names).toEqual(["Fuerza general", "Pretemporada base", "Readaptación tobillo – Fase 2"]);

    await as(NICO);
    expect((await data.profiles.listClients()).length).toBe(8);
    expect(await data.profiles.get(IDS.bruno)).toBeNull();
    expect((await data.sessions.list()).length).toBeGreaterThan(0);
  });

  it("no puede escribir sobre clientes ni rutinas ajenas", async () => {
    await as(CARO);
    await expect(data.routines.saveTree(tree({ clientId: IDS.martina }))).rejects.toThrow(/No tenés acceso/);
    await expect(data.routines.update(routineOf(IDS.martina).id, { name: "hack" })).rejects.toThrow(/No tenés acceso/);
    await expect(data.routines.remove(routineOf(IDS.martina).id)).rejects.toThrow(/No tenés acceso/);
    await expect(data.profiles.update(IDS.martina, { goal: "hack" })).rejects.toThrow();
    expect(routineOf(IDS.martina).name).toBe("Readaptación – Fase 2");
  });

  it("el admin ve todo", async () => {
    await as(ADMIN);
    expect((await data.profiles.listClients()).length).toBe(9);
    expect((await data.routines.list()).length).toBe(getDb().routines.length);
    expect((await data.accessRequests.list()).length).toBe(2);
  });
});

describe("compartido: ejercicios y plantillas", () => {
  it("todos los profes usan la biblioteca y las plantillas; editar una plantilla, solo su autor o el admin", async () => {
    await as(CARO);
    expect((await data.exercises.list()).length).toBe(18);
    const tpl = await data.routines.getTree(template().id);
    expect(tpl?.days.length).toBeGreaterThan(0);
    await expect(data.routines.saveTree({ ...tpl!, name: "hack" })).rejects.toThrow(/No tenés acceso/);
    await expect(data.routines.remove(tpl!.id)).rejects.toThrow();
    const mine = await data.routines.saveTree(tree({ isTemplate: true, startsOn: null, endsOn: null, publishedAt: null, name: "Plantilla de Caro" }));
    expect(mine.createdBy).toBe(IDS.caro);
    await data.exercises.create({
      name: "Press Pallof en rodillas",
      aliases: [],
      category: "Core",
      muscleGroups: [],
      equipment: null,
      videoPath: null,
      videoPosterPath: null,
      videoDurationS: null,
      youtubeUrl: null,
      techniqueCues: [],
      commonMistakes: [],
    });

    await as(NICO);
    expect((await data.exercises.list()).some((e) => e.name === "Press Pallof en rodillas")).toBe(true);
    expect((await data.routines.list()).some((r) => r.name === "Plantilla de Caro")).toBe(true);
    await expect(data.routines.update(mine.id, { name: "hack" })).rejects.toThrow();

    await as(ADMIN);
    await data.routines.update(mine.id, { name: "Plantilla de Caro (revisada)" });
    expect(getDb().routines.find((r) => r.id === mine.id)).toMatchObject({ createdBy: IDS.caro, updatedBy: IDS.admin });
  });
});

describe("asignación de clientes", () => {
  it("el profe crea clientes para sí mismo; el admin elige el profe", async () => {
    await as(CARO);
    const c1 = await data.profiles.createClient({ fullName: "Ana Uno", email: "ana1@test.com", coachId: IDS.nico });
    expect(c1.coachId).toBe(IDS.caro);
    await as(ADMIN);
    const c2 = await data.profiles.createClient({ fullName: "Ana Dos", email: "ana2@test.com", coachId: IDS.caro });
    expect(c2.coachId).toBe(IDS.caro);
  });

  it("solo el admin reasigna; el cliente pasa con sus rutinas", async () => {
    await as(NICO);
    await expect(data.profiles.update(IDS.martina, { coachId: IDS.caro })).rejects.toThrow(/Solo el admin/);
    await as(ADMIN);
    await data.profiles.update(IDS.martina, { coachId: IDS.caro });
    await as(CARO);
    expect((await data.routines.listForClient(IDS.martina)).length).toBe(2);
    await as(NICO);
    expect(await data.profiles.get(IDS.martina)).toBeNull();
  });

  it("solicitudes: el profe ve las suyas; el admin asigna las «Todavía no tengo»", async () => {
    await as(NICO);
    const mine = await data.accessRequests.list();
    expect(mine.map((r) => r.fullName)).toEqual(["Paula D."]);
    await as(CARO);
    expect(await data.accessRequests.list()).toEqual([]);
    await expect(data.accessRequests.approve(mine[0]!.id)).rejects.toThrow();

    await as(ADMIN);
    const diego = (await data.accessRequests.list()).find((r) => r.requestedCoachId === null)!;
    const { profile } = await data.accessRequests.approve(diego.id, { coachId: IDS.caro });
    expect(profile?.coachId).toBe(IDS.caro);
  });
});
