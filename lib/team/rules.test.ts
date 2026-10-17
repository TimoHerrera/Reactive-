import { describe, expect, it } from "vitest";
import {
  canChangeRole,
  canDeactivate,
  canEditProfile,
  canManageTeam,
  checkInviteCode,
  codeExpiry,
  generateInviteCode,
  hashCode,
  normalizeCode,
  parseCreateAdminArgs,
} from "./rules";

const admin = { id: "a", role: "admin" as const };
const coach = { id: "c", role: "coach" as const };
const coach2 = { id: "c2", role: "coach" as const };
const client = { id: "x", role: "client" as const };

describe("permisos del equipo", () => {
  it("solo un admin activo gestiona el equipo", () => {
    expect(canManageTeam(admin)).toBe(true);
    expect(canManageTeam(coach)).toBe(false);
    expect(canManageTeam(client)).toBe(false);
    expect(canManageTeam({ ...admin, disabledAt: "2026-10-01" })).toBe(false);
    expect(canManageTeam(null)).toBe(false);
  });

  it("cada profe edita su perfil (y clientes); el admin edita todos", () => {
    expect(canEditProfile(coach, coach)).toBe(true);
    expect(canEditProfile(coach, client)).toBe(true);
    expect(canEditProfile(coach, coach2)).toBe(false);
    expect(canEditProfile(coach, admin)).toBe(false);
    expect(canEditProfile(admin, coach)).toBe(true);
    expect(canEditProfile(client, client)).toBe(false);
    expect(canEditProfile({ ...coach, disabledAt: "x" }, coach)).toBe(false);
  });

  it("un profe nunca cambia roles (ni el suyo); el admin sí, salvo el propio", () => {
    expect(canChangeRole(coach, coach, "admin")).toBe(false);
    expect(canChangeRole(coach, coach2, "admin")).toBe(false);
    expect(canChangeRole(admin, coach, "admin")).toBe(true);
    expect(canChangeRole(admin, admin, "coach")).toBe(false);
  });

  it("desactivar: solo admin y no a sí mismo", () => {
    expect(canDeactivate(admin, coach)).toBe(true);
    expect(canDeactivate(admin, admin)).toBe(false);
    expect(canDeactivate(coach, coach2)).toBe(false);
  });
});

describe("códigos de invitación", () => {
  it("formato XXXX-XXXX sin caracteres ambiguos", () => {
    for (let i = 0; i < 50; i++) expect(generateInviteCode()).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  });

  it("se normaliza lo que escribe la persona", () => {
    expect(normalizeCode(" k7q4m2xp ")).toBe("K7Q4-M2XP");
    expect(normalizeCode("k7q4-m2xp")).toBe("K7Q4-M2XP");
  });

  it("el hash no depende de mayúsculas ni del guion", async () => {
    expect(await hashCode("k7q4m2xp")).toBe(await hashCode("K7Q4-M2XP"));
    expect(await hashCode("K7Q4-M2XP")).not.toBe(await hashCode("K7Q4-M2XQ"));
  });

  it("un solo uso, atado al email y vence a las 48 h", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    const rec = { email: "Profe@Reactive.com", expiresAt: codeExpiry(now), usedAt: null };
    expect(checkInviteCode(rec, "profe@reactive.com", now)).toBe("ok");
    expect(checkInviteCode(rec, "otra@reactive.com", now)).toBe("wrong-email");
    expect(checkInviteCode({ ...rec, usedAt: now.toISOString() }, "profe@reactive.com", now)).toBe("used");
    expect(checkInviteCode(rec, "profe@reactive.com", new Date(now.getTime() + 49 * 3_600_000))).toBe("expired");
    expect(checkInviteCode(rec, "profe@reactive.com", new Date(now.getTime() + 47 * 3_600_000))).toBe("ok");
    expect(checkInviteCode(null, "profe@reactive.com", now)).toBe("not-found");
  });
});

describe("npm run create-admin", () => {
  it("lee email y nombre", () => {
    expect(parseCreateAdminArgs(["--", "Ana@Reactive.com", "Ana", "Pérez"])).toEqual({ ok: true, email: "ana@reactive.com", name: "Ana Pérez" });
    expect(parseCreateAdminArgs(["ana@reactive.com", "Ana Pérez"])).toEqual({ ok: true, email: "ana@reactive.com", name: "Ana Pérez" });
  });
  it("pide email válido y nombre", () => {
    expect(parseCreateAdminArgs([]).ok).toBe(false);
    expect(parseCreateAdminArgs(["no-es-email", "Ana"]).ok).toBe(false);
    expect(parseCreateAdminArgs(["ana@reactive.com"]).ok).toBe(false);
  });
});
