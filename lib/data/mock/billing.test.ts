// @vitest-environment happy-dom
// Pagos: profe → sus pacientes; admin → todos; paciente → lo suyo, solo si está activado en Ajustes
// (mismas reglas que RLS en 0011_pagos.sql).
import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PASSWORD, IDS } from "@/lib/data/seed";
import { mockDataSource as data } from "./index";
import { getDb, resetMockDb } from "./store";

const as = async (email: string) => {
  await data.auth.signOut();
  expect(await data.auth.signIn(email, DEMO_PASSWORD)).toMatchObject({ ok: true });
};
const MARTINA = "martina@reactive.test";
const NICO = "nico@reactive.test";
const CARO = "caro@reactive.test";
const ADMIN = "admin@reactive.test";
const pago = (clientId: string) => ({ clientId, amountCents: 3_500_000, paidAt: "2026-10-16", method: "transferencia" as const, period: "2026-11", sessions: null, note: null });

beforeEach(async () => {
  await data.auth.signOut();
  resetMockDb();
});

describe("permisos de pagos", () => {
  it("Nico ve los de sus pacientes, Caro solo los de Bruno, el admin todos", async () => {
    await as(NICO);
    const nico = await data.billing.listPayments();
    expect(nico.length).toBeGreaterThan(0);
    expect(nico.some((p) => p.clientId === IDS.bruno)).toBe(false);
    await as(CARO);
    expect(new Set((await data.billing.listPayments()).map((p) => p.clientId))).toEqual(new Set([IDS.bruno]));
    await as(ADMIN);
    expect(await data.billing.listPayments()).toHaveLength(getDb().payments.length);
  });

  it("la paciente ve solo lo suyo, y nada si el admin apaga «Mostrar estado de cuota»", async () => {
    await as(MARTINA);
    expect((await data.billing.listPlans()).map((p) => p.clientId)).toEqual([IDS.martina]);
    expect((await data.billing.listPayments()).every((p) => p.clientId === IDS.martina)).toBe(true);
    await as(ADMIN);
    await data.settings.update({ showBillingToClient: false });
    await as(MARTINA);
    expect(await data.billing.listPlans()).toEqual([]);
    expect(await data.billing.listPayments()).toEqual([]);
  });

  it("Nico registra un pago de Martina (a su nombre) pero no de Bruno", async () => {
    await as(NICO);
    expect(await data.billing.addPayment(pago(IDS.martina))).toMatchObject({ registeredBy: IDS.nico, amountCents: 3_500_000 });
    await expect(data.billing.addPayment(pago(IDS.bruno))).rejects.toThrow();
  });

  it("la paciente no registra pagos ni cambia su plan", async () => {
    await as(MARTINA);
    await expect(data.billing.addPayment(pago(IDS.martina))).rejects.toThrow();
    await expect(data.billing.setPlan(IDS.martina, { kind: "mensual", amountCents: 1, dueDay: 10, packSessions: null, startsOn: "2026-10-01", active: true })).rejects.toThrow();
  });

  it("solo el admin cambia los ajustes", async () => {
    await as(NICO);
    await expect(data.settings.update({ transferAlias: "otro" })).rejects.toThrow();
    await as(ADMIN);
    expect(await data.settings.update({ transferAlias: "  reactive.mp  " })).toMatchObject({ transferAlias: "reactive.mp" });
  });

  it("valida montos", async () => {
    await as(NICO);
    await expect(data.billing.addPayment({ ...pago(IDS.martina), amountCents: 0 })).rejects.toThrow("mayor a $ 0");
  });
});
