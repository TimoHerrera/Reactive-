import { describe, expect, it } from "vitest";
import {
  authorLine,
  canEditRoutine,
  canReassignClient,
  canSeeAccessRequest,
  canSeeClient,
  canSeeProfile,
  canSeeRoutine,
  clientIdsOfCoach,
  coachForNewClient,
  routineMatchesCoach,
} from "./scope";
import type { Profile } from "@/lib/data/types";

const admin = { id: "a", role: "admin" as const };
const nico = { id: "n", role: "coach" as const };
const jano = { id: "j", role: "coach" as const };
const martina = { id: "m", role: "client" as const, coachId: "n" };
const bruno = { id: "b", role: "client" as const, coachId: "j" };
const routine = (p: Partial<{ clientId: string | null; isTemplate: boolean; createdBy: string | null; publishedAt: string | null }>) => ({
  clientId: null,
  isTemplate: false,
  createdBy: null,
  publishedAt: "2026-10-01",
  ...p,
});

describe("clientes", () => {
  it("el profe ve solo los suyos; el admin, todos; el cliente, a sí mismo", () => {
    expect(canSeeClient(nico, martina)).toBe(true);
    expect(canSeeClient(jano, martina)).toBe(false);
    expect(canSeeClient(admin, martina)).toBe(true);
    expect(canSeeClient({ id: "m", role: "client" }, martina)).toBe(true);
    expect(canSeeClient({ id: "b", role: "client" }, martina)).toBe(false);
    expect(canSeeClient(null, martina)).toBe(false);
  });

  it("los perfiles de profes son visibles para cualquier logueado", () => {
    const staff = { id: "n", role: "coach", coachId: null } as Profile;
    expect(canSeeProfile({ id: "m", role: "client" }, staff)).toBe(true);
    expect(canSeeProfile(jano, martina as Profile)).toBe(false);
    expect(canSeeProfile(null, staff)).toBe(false);
  });

  it("al crear: el profe se lo queda; el admin elige; solo el admin reasigna", () => {
    expect(coachForNewClient(jano, "n")).toBe("j");
    expect(coachForNewClient(admin, "n")).toBe("n");
    expect(coachForNewClient(admin, null)).toBe("a");
    expect(coachForNewClient({ id: "m", role: "client" }, "n")).toBeNull();
    expect(canReassignClient(admin)).toBe(true);
    expect(canReassignClient(nico)).toBe(false);
  });
});

describe("rutinas", () => {
  it("rutina de cliente: la ve y edita su profe (y el admin); el cliente solo la ve publicada", () => {
    const r = routine({ clientId: "m", createdBy: "n" });
    expect(canSeeRoutine(nico, r, martina)).toBe(true);
    expect(canSeeRoutine(jano, r, martina)).toBe(false);
    expect(canEditRoutine(jano, r, martina)).toBe(false);
    expect(canEditRoutine(admin, r, martina)).toBe(true);
    expect(canSeeRoutine({ id: "m", role: "client" }, r, martina)).toBe(true);
    expect(canSeeRoutine({ id: "m", role: "client" }, { ...r, publishedAt: null }, martina)).toBe(false);
    expect(canEditRoutine({ id: "m", role: "client" }, r, martina)).toBe(false);
  });

  it("si el cliente pasa a otro profe, la rutina pasa con él (aunque la haya cargado el anterior)", () => {
    const r = routine({ clientId: "b", createdBy: "n" });
    expect(canEditRoutine(jano, r, bruno)).toBe(true);
    expect(canSeeRoutine(nico, r, bruno)).toBe(false);
  });

  it("plantillas: las ven todos los profes; las edita su autor o el admin", () => {
    const t = routine({ isTemplate: true, createdBy: "n", publishedAt: null });
    expect(canSeeRoutine(jano, t, null)).toBe(true);
    expect(canEditRoutine(jano, t, null)).toBe(false);
    expect(canEditRoutine(nico, t, null)).toBe(true);
    expect(canEditRoutine(admin, t, null)).toBe(true);
    expect(canSeeRoutine({ id: "m", role: "client" }, t, null)).toBe(false);
  });
});

describe("solicitudes de acceso", () => {
  it("el profe ve las que lo eligieron; las «Todavía no tengo», solo el admin", () => {
    expect(canSeeAccessRequest(nico, { requestedCoachId: "n" })).toBe(true);
    expect(canSeeAccessRequest(jano, { requestedCoachId: "n" })).toBe(false);
    expect(canSeeAccessRequest(nico, { requestedCoachId: null })).toBe(false);
    expect(canSeeAccessRequest(admin, { requestedCoachId: null })).toBe(true);
  });
});

describe("autor y filtro del admin", () => {
  const names: Record<string, string> = { n: "Nico R.", j: "Jano", a: "Admin" };
  const nameOf = (id: string) => names[id] ?? null;

  it("«Cargada por X · editada por Y» solo si la editó otra persona", () => {
    expect(authorLine("j", null, nameOf)).toBe("Cargada por Jano");
    expect(authorLine("j", "j", nameOf)).toBe("Cargada por Jano");
    expect(authorLine("j", "a", nameOf)).toBe("Cargada por Jano · editada por Admin");
    expect(authorLine(null, null, nameOf)).toBeNull();
  });

  it("filtra clientes por profe y plantillas por autor", () => {
    const ids = clientIdsOfCoach([martina, bruno], "j")!;
    expect([...ids]).toEqual(["b"]);
    expect(clientIdsOfCoach([martina, bruno], null)).toBeNull();
    expect(routineMatchesCoach({ clientId: "b", createdBy: "n" }, ids, "j")).toBe(true);
    expect(routineMatchesCoach({ clientId: "m", createdBy: "n" }, ids, "j")).toBe(false);
    expect(routineMatchesCoach({ clientId: null, createdBy: "j" }, ids, "j")).toBe(true);
    expect(routineMatchesCoach({ clientId: null, createdBy: "n" }, null, null)).toBe(true);
  });
});
