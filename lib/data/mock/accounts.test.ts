// @vitest-environment happy-dom
// Una persona = un email, y bajas de usuarios (desactivar / eliminar) en modo mock.
// Mismas reglas que Supabase: 0008_accounts.sql (índice único) + app/actions/accounts.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onSessionRevoked } from "@/lib/auth/session-events";
import { duplicateReason } from "@/lib/access/rules";
import { DEMO_PASSWORD, IDS } from "@/lib/data/seed";
import { DuplicateEmailError, isDuplicateEmail, sameName } from "../errors";
import { mockDataSource as data, resetDemoData } from "./index";
import { getDb, mutate, resetMockDb } from "./store";

const as = async (email: string) => {
  await data.auth.signOut();
  expect(await data.auth.signIn(email, DEMO_PASSWORD)).toMatchObject({ ok: true });
};
const ADMIN = "admin@reactive.test";
const NICO = "nico@reactive.test";
const CARO = "caro@reactive.test";
const profile = (id: string) => getDb().profiles.find((p) => p.id === id);

beforeEach(async () => {
  window.localStorage.clear();
  resetMockDb();
  await data.auth.signOut();
});

describe("un email = una persona", () => {
  it("no se pueden crear dos usuarios con «Juan@Gmail.com» y «juan@gmail.com»", async () => {
    await as(NICO);
    const juan = await data.profiles.createClient({ fullName: "Juan Uno", email: "  Juan@Gmail.com " });
    expect(juan.email).toBe("juan@gmail.com");
    const err = await data.profiles.createClient({ fullName: "Juan Dos", email: "juan@gmail.com" }).catch((e) => e);
    expect(err).toBeInstanceOf(DuplicateEmailError);
    expect(err.message).toBe("Ya existe un usuario con ese email.");
    expect(err.existing).toEqual({ id: juan.id, href: `/coach/clientes/${juan.id}` }); // «Ver ficha»
    expect(getDb().profiles.filter((p) => p.email === "juan@gmail.com")).toHaveLength(1);

    // Tampoco como profe, ni cambiando el email de otro.
    await as(ADMIN);
    expect(isDuplicateEmail(await data.team.invite({ fullName: "Juan Profe", email: "JUAN@gmail.com", role: "coach" }).catch((e) => e))).toBe(true);
    await expect(data.profiles.update(IDS.martina, { email: "Juan@Gmail.COM" })).rejects.toThrow("Ya existe un usuario con ese email.");
  });

  it("«Ver ficha» solo si quien pregunta puede verla", async () => {
    await as(CARO);
    const err = await data.profiles.createClient({ fullName: "Otra Martina", email: "MARTINA@reactive.test" }).catch((e) => e);
    expect(err.existing).toEqual({ id: IDS.martina, href: null }); // es clienta de Nico
  });

  it("pedir acceso: cuenta activa, pausada o solicitud pendiente", async () => {
    const base = { fullName: "Martina Gómez", phone: "11 5555 0101", requestedCoachId: null, caseType: null, message: "" };
    expect(await data.accessRequests.submit({ ...base, email: "Martina@Reactive.test" })).toMatchObject({ ok: false, reason: "account" });
    mutate((db) => {
      db.profiles.find((p) => p.id === IDS.martina)!.disabledAt = new Date().toISOString();
    });
    expect(await data.accessRequests.submit({ ...base, email: "martina@reactive.test" })).toMatchObject({
      ok: false,
      reason: "paused",
      message: "Tu cuenta está pausada, escribinos por WhatsApp.",
    });
    expect(await data.accessRequests.submit({ ...base, fullName: "Paula Díaz", email: "PAULA@reactive.test" })).toMatchObject({ reason: "pending" });
    expect(duplicateReason("a@b.com", [], [{ email: "A@B.com", disabledAt: null }])).toBe("account");
  });

  it("aprobar una solicitud cuyo email ya existe → se ofrece vincularla, no se crea otro usuario", async () => {
    await as(ADMIN);
    const req = getDb().accessRequests.find((r) => r.requestedCoachId === null)!;
    mutate((db) => {
      db.accessRequests.find((r) => r.id === req.id)!.email = "martina@reactive.test";
    });
    const before = getDb().profiles.length;
    await expect(data.accessRequests.approve(req.id, { coachId: IDS.nico })).rejects.toBeInstanceOf(DuplicateEmailError);
    const res = await data.accessRequests.approve(req.id, { coachId: IDS.nico, linkExisting: true });
    expect(res).toMatchObject({ linked: true, activationLink: null, profile: { id: IDS.martina } });
    expect(getDb().profiles.length).toBe(before);
    expect(getDb().accessRequests.find((r) => r.id === req.id)).toMatchObject({ status: "approved", linkedProfileId: IDS.martina });
  });
});

describe("desactivar", () => {
  it("el profe desactiva a su cliente: no puede loguearse, el historial queda y el email sigue reservado", async () => {
    await as(NICO);
    const sessions = getDb().workoutSessions.filter((s) => s.clientId === IDS.martina).length;
    await data.profiles.setClientActive(IDS.martina, false);
    expect(await data.auth.signIn("martina@reactive.test", DEMO_PASSWORD)).toMatchObject({ ok: false, error: expect.stringMatching(/desactivado/) });
    await as(NICO);
    expect(getDb().workoutSessions.filter((s) => s.clientId === IDS.martina)).toHaveLength(sessions);
    expect(isDuplicateEmail(await data.profiles.createClient({ fullName: "X Y", email: "martina@reactive.test" }).catch((e) => e))).toBe(true);
    // Reactivar
    await data.profiles.setClientActive(IDS.martina, true);
    await as("martina@reactive.test");
  });

  it("un profe no desactiva clientes de otro profe", async () => {
    await as(CARO);
    await expect(data.profiles.setClientActive(IDS.martina, false)).rejects.toThrow();
    expect(profile(IDS.martina)?.disabledAt).toBeNull();
  });

  it("desactivado o eliminado con la sesión abierta: queda deslogueado en su próxima acción", async () => {
    const revoked = vi.fn();
    const off = onSessionRevoked(revoked);
    await as("martina@reactive.test");
    mutate((db) => {
      db.profiles.find((p) => p.id === IDS.martina)!.disabledAt = new Date().toISOString();
    });
    expect(await data.routines.listForClient(IDS.martina)).toEqual([]); // su próxima acción
    expect(await data.auth.getUser()).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
    expect(revoked).toHaveBeenCalled();
    expect(document.cookie).not.toContain("martina");
    off();
  });
});

describe("eliminar definitivamente", () => {
  it("un profe no puede eliminar usuarios", async () => {
    await as(NICO);
    await expect(data.profiles.remove(IDS.martina, { confirmName: "Martina G." })).rejects.toThrow(/Solo un admin/);
    expect(profile(IDS.martina)).toBeDefined();
  });

  it("hay que escribir el nombre, y el admin no se elimina a sí mismo", async () => {
    await as(ADMIN);
    await expect(data.profiles.remove(IDS.martina, { confirmName: "Martina" })).rejects.toThrow(/Escribí «Martina G\.»/);
    await expect(data.profiles.remove(IDS.admin, { confirmName: "Admin Reactive" })).rejects.toThrow(/No podés eliminarte/);
    expect(sameName("  martina   g. ", "Martina G.")).toBe(true);
  });

  it("cliente: borra perfil, rutinas, sesiones, observaciones y solicitudes; el email queda libre", async () => {
    await as(ADMIN);
    await data.profiles.remove(IDS.martina, { confirmName: "martina g." });
    const db = getDb();
    expect(profile(IDS.martina)).toBeUndefined();
    expect(db.routines.filter((r) => r.clientId === IDS.martina)).toEqual([]);
    expect(db.workoutSessions.filter((s) => s.clientId === IDS.martina)).toEqual([]);
    expect(db.coachNotes.filter((n) => n.clientId === IDS.martina)).toEqual([]);
    const again = await data.profiles.createClient({ fullName: "Martina G.", email: "martina@reactive.test", coachId: IDS.nico });
    expect(again.id).not.toBe(IDS.martina);
  });

  it("profe: sin reasignar sus clientes está bloqueado; después, sus ejercicios y plantillas pasan al admin", async () => {
    await as(ADMIN);
    await expect(data.profiles.remove(IDS.nico, { confirmName: "Nico R." })).rejects.toThrow(/reasigná sus 8 clientes/);
    expect(profile(IDS.nico)).toBeDefined();

    await data.profiles.remove(IDS.nico, { confirmName: "Nico R.", reassignTo: IDS.caro });
    const db = getDb();
    expect(profile(IDS.nico)).toBeUndefined();
    expect(db.profiles.filter((p) => p.coachId === IDS.caro)).toHaveLength(9);
    expect(db.exercises.every((e) => e.createdBy !== IDS.nico)).toBe(true);
    expect(db.exercises.filter((e) => e.createdBy === IDS.admin).length).toBeGreaterThan(0);
    expect(db.routines.filter((r) => r.isTemplate).every((r) => r.createdBy === IDS.admin)).toBe(true);
    expect(db.routines.filter((r) => r.clientId === IDS.martina)).toHaveLength(2); // el historial de sus clientes queda
    await as(ADMIN);
    expect((await data.profiles.createClient({ fullName: "Nico Nuevo", email: "nico@reactive.test", coachId: IDS.caro })).email).toBe("nico@reactive.test");
  });
});

describe("restablecer datos de demo", () => {
  it("solo el admin; vuelve al seed y borra los usuarios de prueba", async () => {
    await as(NICO);
    await data.profiles.createClient({ fullName: "Prueba Vieja", email: "vieja@test.com" });
    await expect(resetDemoData()).rejects.toThrow();
    await as(ADMIN);
    await resetDemoData();
    expect(getDb().profiles.some((p) => p.email === "vieja@test.com")).toBe(false);
    expect(getDb().profiles.length).toBe(13);
  });
});
