import { describe, expect, it } from "vitest";
import { mockDataSource } from "@/lib/data/mock";
import { cleanAccessRequest, duplicateReason, isRateLimited, MESSAGES, validateAccessRequest, type AccessRequestInput } from "./rules";

const base: AccessRequestInput = {
  fullName: "  Ana   Pérez ",
  email: " Ana.Perez@Mail.com ",
  phone: "11 5555-0101",
  requestedCoachId: null,
  caseType: "rendimiento",
  message: "",
};

describe("validación", () => {
  it("pide nombre y apellido, email válido y WhatsApp", () => {
    expect(validateAccessRequest(base)).toEqual({});
    expect(validateAccessRequest({ ...base, fullName: "Ana" }).fullName).toBeTruthy();
    expect(validateAccessRequest({ ...base, email: "ana@" }).email).toBeTruthy();
    expect(validateAccessRequest({ ...base, phone: "123" }).phone).toBeTruthy();
    expect(validateAccessRequest({ ...base, message: "x".repeat(501) }).message).toBeTruthy();
  });

  it("limpia los datos (email en minúsculas, espacios, mensaje vacío → null)", () => {
    expect(cleanAccessRequest(base)).toEqual({
      fullName: "Ana Pérez",
      email: "ana.perez@mail.com",
      phone: "11 5555-0101",
      requestedCoachId: null,
      caseType: "rendimiento",
      message: null,
    });
  });
});

describe("duplicados y límite", () => {
  it("cuenta existente gana sobre solicitud pendiente", () => {
    expect(duplicateReason("ANA@x.com", [{ email: "ana@x.com", status: "pending" }], [])).toBe("pending");
    expect(duplicateReason("ana@x.com", [{ email: "ana@x.com", status: "pending" }], ["Ana@x.com"])).toBe("account");
    expect(duplicateReason("ana@x.com", [{ email: "ana@x.com", status: "rejected" }], [])).toBeNull();
  });

  it("límite por email (3 en 24 h) y por IP (5 en 1 h)", () => {
    const now = new Date("2026-10-12T12:00:00Z");
    const at = (minAgo: number) => new Date(now.getTime() - minAgo * 60_000).toISOString();
    const byEmail = [1, 2, 3].map((m) => ({ email: "ana@x.com", createdAt: at(m * 60) }));
    expect(isRateLimited(byEmail, "ana@x.com", null, now)).toBe(true);
    expect(isRateLimited(byEmail.slice(0, 2), "ana@x.com", null, now)).toBe(false);
    expect(isRateLimited([{ email: "ana@x.com", createdAt: at(60 * 30) }], "ana@x.com", null, now)).toBe(false);
    const byIp = [1, 2, 3, 4, 5].map((m) => ({ email: `p${m}@x.com`, ipHash: "abc", createdAt: at(m * 5) }));
    expect(isRateLimited(byIp, "nuevo@x.com", "abc", now)).toBe(true);
    expect(isRateLimited(byIp, "nuevo@x.com", "otra", now)).toBe(false);
  });
});

describe("flujo en modo mock", () => {
  const repo = mockDataSource.accessRequests;

  it("lista los profes activos para el selector", async () => {
    const coaches = await repo.listCoaches();
    expect(coaches.map((c) => c.fullName)).toEqual(["Nico R."]);
  });

  it("pedido válido → ok; repetido → pendiente; cuenta existente → «Ya tenés cuenta»", async () => {
    const ok = await repo.submit({ ...base, email: "nueva.persona@test.com" });
    expect(ok.ok).toBe(true);
    const again = await repo.submit({ ...base, email: "NUEVA.persona@test.com" });
    expect(again).toMatchObject({ ok: false, reason: "pending", message: MESSAGES.pending });
    const account = await repo.submit({ ...base, email: "martina@reactive.test" });
    expect(account).toMatchObject({ ok: false, reason: "account", message: "Ya tenés cuenta: ingresá o recuperá tu contraseña." });
  });

  it("honeypot completado → se descarta; datos inválidos → errores por campo", async () => {
    expect(await repo.submit({ ...base, email: "bot@test.com", website: "http://spam" })).toMatchObject({ ok: false, reason: "spam" });
    const bad = await repo.submit({ ...base, fullName: "A", email: "x" });
    expect(bad.ok).toBe(false);
    if (!bad.ok && bad.reason === "invalid") expect(Object.keys(bad.errors).sort()).toEqual(["email", "fullName"]);
  });
});
