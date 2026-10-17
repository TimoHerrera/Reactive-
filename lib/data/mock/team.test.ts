// @vitest-environment happy-dom
// Gestión del equipo en modo mock: mismos permisos que RLS + server actions en Supabase.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_PASSWORD, IDS } from "@/lib/data/seed";
import type { ProfilePatch } from "../repositories";
import { mockDataSource as data } from "./index";
import { getDb, mutate, resetMockDb } from "./store";

const login = async (email: string, password = DEMO_PASSWORD) => {
  const res = await data.auth.signIn(email, password);
  expect(res).toMatchObject({ ok: true });
};
const tokenOf = (link: string | null) => new URL(link!).searchParams.get("token");
const profile = (id: string) => getDb().profiles.find((p) => p.id === id)!;

beforeEach(async () => {
  window.localStorage.clear();
  resetMockDb();
  await data.auth.signOut();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("admin invita a un profe", () => {
  it("+ PROFE → link → crea su contraseña → entra como profe (activo)", async () => {
    await login("admin@reactive.test");
    const { profile: p, activationLink } = await data.team.invite({
      fullName: "Juli Profe",
      email: "Juli@Reactive.test",
      title: "Kinesióloga",
      phone: "+54 9 11 5555-0199",
      role: "coach",
    });
    expect(p.email).toBe("juli@reactive.test");
    expect(activationLink).toMatch(/\/activar\?token=/);
    expect((await data.team.list()).find((m) => m.id === p.id)).toMatchObject({ status: "pendiente", clientCount: 0 });
    await data.auth.signOut();

    // Pendiente: no entra con la contraseña demo.
    expect((await data.auth.signIn("juli@reactive.test", DEMO_PASSWORD)).ok).toBe(false);

    const user = await data.auth.activate(tokenOf(activationLink));
    expect(user).toMatchObject({ id: p.id, role: "coach" });
    await data.auth.updatePassword("contraseña-juli");
    expect(profile(p.id).activatedAt).not.toBeNull();
    expect((await data.profiles.listClients()).length).toBe(0); // profe nuevo: todavía sin clientes propios

    await data.auth.signOut();
    await login("juli@reactive.test", "contraseña-juli");
    await data.auth.signOut();
    await login("admin@reactive.test");
    expect((await data.team.list()).find((m) => m.id === p.id)?.status).toBe("activo");
  });

  it("no se repiten emails y reenviar solo sirve para pendientes", async () => {
    await login("admin@reactive.test");
    await expect(data.team.invite({ fullName: "Otro Nico", email: "nico@reactive.test", role: "coach" })).rejects.toThrow(/Ya existe/);
    expect((await data.team.resend(IDS.lu)).activationLink).toMatch(/token=/);
    await expect(data.team.resend(IDS.nico)).rejects.toThrow(/Ya activó/);
  });
});

describe("códigos de invitación", () => {
  it("un solo uso, atado al email; activa la cuenta y deja la sesión iniciada", async () => {
    await login("admin@reactive.test");
    const { code } = await data.team.createCode(IDS.lu);
    expect(code).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    expect(getDb().inviteCodes.some((c) => c.codeHash.includes(code))).toBe(false); // se guarda hasheado
    await data.auth.signOut();

    expect(await data.auth.redeemCode("caro@reactive.test", code, "nueva-clave-lu")).toMatchObject({ ok: false });
    expect(await data.auth.redeemCode("lu@reactive.test", "AAAA-BBBB", "nueva-clave-lu")).toMatchObject({ ok: false });
    const ok = await data.auth.redeemCode("LU@reactive.test", code.toLowerCase().replace("-", ""), "nueva-clave-lu");
    expect(ok).toMatchObject({ ok: true, user: { id: IDS.lu, role: "coach" } });
    expect((await data.auth.getUser())?.id).toBe(IDS.lu);
    expect(profile(IDS.lu).activatedAt).not.toBeNull();

    await data.auth.signOut();
    expect(await data.auth.redeemCode("lu@reactive.test", code, "otra-clave-123")).toMatchObject({ ok: false, error: expect.stringMatching(/ya se usó/) });
    await login("lu@reactive.test", "nueva-clave-lu");
  });

  it("vence a las 48 h y generar uno nuevo invalida el anterior", async () => {
    await login("admin@reactive.test");
    const first = await data.team.createCode(IDS.lu);
    const second = await data.team.createCode(IDS.lu);
    await data.auth.signOut();
    expect(await data.auth.redeemCode("lu@reactive.test", first.code, "clave-lu-123")).toMatchObject({ ok: false });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 49 * 3_600_000);
    expect(await data.auth.redeemCode("lu@reactive.test", second.code, "clave-lu-123")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/venció/),
    });
  });
});

describe("permisos", () => {
  it("un profe no gestiona el equipo ni cambia roles", async () => {
    await login("nico@reactive.test");
    await expect(data.team.list()).rejects.toThrow();
    await expect(data.team.invite({ fullName: "X Y", email: "x@y.com", role: "admin" })).rejects.toThrow();
    await expect(data.team.setRole(IDS.nico, "admin")).rejects.toThrow();
    await expect(data.team.setRole(IDS.caro, "admin")).rejects.toThrow();
    await expect(data.team.createCode(IDS.lu)).rejects.toThrow();
    await expect(data.team.deactivate(IDS.caro, null)).rejects.toThrow();
    expect(profile(IDS.nico).role).toBe("coach");
  });

  it("cada profe edita su perfil (no su rol ni su estado); no el de otro profe", async () => {
    await login("nico@reactive.test");
    const saved = await data.profiles.update(IDS.nico, {
      bio: "Readaptación deportiva.",
      title: "Kinesiólogo",
      ...({ role: "admin", disabledAt: "2026-01-01" } as unknown as ProfilePatch),
    });
    expect(saved).toMatchObject({ bio: "Readaptación deportiva.", role: "coach", disabledAt: null });
    await expect(data.profiles.update(IDS.caro, { title: "hack" })).rejects.toThrow();
    await expect(data.profiles.update(IDS.admin, { title: "hack" })).rejects.toThrow();
    expect(profile(IDS.caro).title).not.toBe("hack");
  });

  it("el admin edita a cualquiera y cambia roles, pero no el suyo", async () => {
    await login("admin@reactive.test");
    await data.profiles.update(IDS.caro, { bio: "Fuerza." });
    expect(profile(IDS.caro).bio).toBe("Fuerza.");
    expect((await data.team.setRole(IDS.caro, "admin")).role).toBe("admin");
    await expect(data.team.setRole(IDS.admin, "coach")).rejects.toThrow();
    await expect(data.team.deactivate(IDS.admin, null)).rejects.toThrow();
  });
});

describe("desactivar", () => {
  it("obliga a reasignar sus clientes; el historial queda", async () => {
    await login("admin@reactive.test");
    const routinesBefore = (await data.routines.list()).length;
    const nicoClients = getDb().profiles.filter((p) => p.coachId === IDS.nico).map((p) => p.id);
    expect(nicoClients.length).toBeGreaterThan(0);

    await expect(data.team.deactivate(IDS.nico, null)).rejects.toThrow(/Elegí a qué profe/);
    await expect(data.team.deactivate(IDS.nico, IDS.nico)).rejects.toThrow();
    await data.team.deactivate(IDS.nico, IDS.caro);

    expect(nicoClients.every((id) => profile(id).coachId === IDS.caro)).toBe(true);
    expect((await data.routines.list()).length).toBe(routinesBefore);
    const nico = (await data.team.list()).find((m) => m.id === IDS.nico)!;
    expect(nico).toMatchObject({ status: "desactivado", clientCount: 0 });
    expect((await data.accessRequests.listCoaches()).map((c) => c.id)).not.toContain(IDS.nico);
  });

  it("pierde el acceso al instante y no lee nada; al reactivar vuelve a entrar", async () => {
    await login("caro@reactive.test");
    expect((await data.exercises.list()).length).toBeGreaterThan(0);

    // El admin lo desactiva (desde otro dispositivo): la sesión abierta deja de valer.
    mutate((db) => {
      db.profiles.find((p) => p.id === IDS.caro)!.disabledAt = new Date().toISOString();
    });
    expect(await data.auth.getUser()).toBeNull();
    expect(await data.exercises.list()).toEqual([]);
    expect(await data.profiles.listClients()).toEqual([]);
    await expect(data.exercises.create({} as never)).rejects.toThrow();

    expect(await data.auth.signIn("caro@reactive.test", DEMO_PASSWORD)).toMatchObject({ ok: false, error: expect.stringMatching(/desactivado/) });

    await login("admin@reactive.test");
    await data.team.reactivate(IDS.caro);
    await data.auth.signOut();
    await login("caro@reactive.test");
  });
});
