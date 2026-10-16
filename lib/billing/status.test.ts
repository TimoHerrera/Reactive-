import { describe, expect, it } from "vitest";
import type { ClientPlan, Payment } from "@/lib/data/types";
import {
  billingStatus,
  dueDateFor,
  formatMoney,
  monthSummary,
  parseMoney,
  paymentReminderText,
  paymentRows,
  suggestedPayment,
  toCsv,
} from "./status";

const plan = (p: Partial<ClientPlan> = {}): ClientPlan => ({
  clientId: "m",
  kind: "mensual",
  amountCents: 2_500_000,
  dueDay: 10,
  packSessions: null,
  startsOn: "2026-08-01",
  active: true,
  updatedAt: "",
  ...p,
});
let n = 0;
const pay = (p: Partial<Payment>): Payment => ({
  id: `p${++n}`,
  clientId: "m",
  amountCents: 2_500_000,
  paidAt: "2026-10-05",
  method: "transferencia",
  period: null,
  sessions: null,
  note: null,
  registeredBy: null,
  createdAt: "",
  ...p,
});
const paidMonths = (...periods: string[]) => periods.map((period) => pay({ period, paidAt: `${period}-05` }));

describe("montos", () => {
  it("formato argentino: $ 25.000", () => {
    expect(formatMoney(2_500_000)).toBe("$ 25.000");
    expect(formatMoney(2_500_050)).toBe("$ 25.000,50");
    expect(formatMoney(0)).toBe("$ 0");
    expect(formatMoney(150_000_000)).toBe("$ 1.500.000");
  });
  it("lee lo que escribe el profe", () => {
    expect(parseMoney("25.000")).toBe(2_500_000);
    expect(parseMoney("25000")).toBe(2_500_000);
    expect(parseMoney("$ 25.000,50")).toBe(2_500_050);
    expect(parseMoney("25000.5")).toBe(2_500_050);
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });
});

describe("plan mensual", () => {
  it("vencimiento en meses cortos: el último día", () => {
    expect(dueDateFor("2026-02", 31)).toBe("2026-02-28");
    expect(dueDateFor("2026-10", 10)).toBe("2026-10-10");
  });
  it("al día: pagó octubre; noviembre vence el 10/11", () => {
    const s = billingStatus(plan(), paidMonths("2026-08", "2026-09", "2026-10"), [], "2026-10-16");
    expect(s).toMatchObject({ state: "al_dia", detail: "vence el 10/11", amountDueCents: 0, periodToCharge: "2026-11" });
  });
  it("por vencer: faltan 5 días o menos", () => {
    const s = billingStatus(plan(), paidMonths("2026-08", "2026-09"), [], "2026-10-05");
    expect(s).toMatchObject({ state: "por_vencer", detail: "vence el 10/10", amountDueCents: 2_500_000, periodToCharge: "2026-10" });
    expect(billingStatus(plan(), paidMonths("2026-08", "2026-09"), [], "2026-10-04").state).toBe("al_dia");
  });
  it("vencido con días de atraso", () => {
    const s = billingStatus(plan(), paidMonths("2026-08", "2026-09"), [], "2026-10-16");
    expect(s).toMatchObject({ state: "vencido", daysLate: 6, detail: "vencido hace 6 días", amountDueCents: 2_500_000, concept: "la cuota de octubre" });
  });
  it("debe varios meses: cuenta desde el más viejo y suma lo que falta", () => {
    const s = billingStatus(plan(), [...paidMonths("2026-08"), pay({ period: "2026-10", amountCents: 1_000_000 })], [], "2026-10-16");
    expect(s.overduePeriods).toEqual(["2026-09", "2026-10"]);
    expect(s).toMatchObject({ state: "vencido", daysLate: 36, amountDueCents: 4_000_000, concept: "las cuotas de septiembre y octubre" });
    expect(s.detail).toBe("vencido hace 36 días · debe 2 meses");
  });
  it("arranca este mes: no debe meses anteriores al inicio", () => {
    expect(billingStatus(plan({ startsOn: "2026-10-12" }), [], [], "2026-10-16").state).toBe("vencido");
    expect(billingStatus(plan({ startsOn: "2026-10-12", dueDay: 20 }), [], [], "2026-10-16").state).toBe("por_vencer");
  });
  it("sin plan o plan pausado", () => {
    expect(billingStatus(null, [], [], "2026-10-16").state).toBe("sin_plan");
    expect(billingStatus(plan({ active: false }), [], [], "2026-10-16").detail).toBe("Plan pausado");
  });
});

describe("pack de sesiones (descuenta los turnos con «asistió»)", () => {
  const pack = plan({ kind: "pack", amountCents: 8_000_000, packSessions: 8, dueDay: null, startsOn: "2026-09-01" });
  const bought = [pay({ sessions: 8, amountCents: 8_000_000, paidAt: "2026-09-01" })];
  const days = (k: number) => Array.from({ length: k }, (_, i) => `2026-09-${String(i + 2).padStart(2, "0")}`);
  it("quedan N sesiones", () => {
    expect(billingStatus(pack, bought, days(5), "2026-10-16")).toMatchObject({ state: "al_dia", sessionsLeft: 3, detail: "quedan 3 sesiones" });
  });
  it("queda 1 → por vencer; 0 → renovar pack", () => {
    expect(billingStatus(pack, bought, days(7), "2026-10-16")).toMatchObject({ state: "por_vencer", detail: "queda 1 sesión" });
    expect(billingStatus(pack, bought, days(8), "2026-10-16")).toMatchObject({ state: "renovar", sessionsLeft: 0, amountDueCents: 8_000_000 });
  });
  it("usó de más → vencido", () => {
    expect(billingStatus(pack, bought, days(10), "2026-10-16")).toMatchObject({ state: "vencido", sessionsLeft: -2, detail: "usó 2 sesiones sin pagar" });
  });
  it("las asistencias anteriores al inicio del plan no cuentan", () => {
    expect(billingStatus(pack, bought, ["2026-08-20", ...days(2)], "2026-10-16").sessionsLeft).toBe(6);
  });
  it("renovar suma otro pack", () => {
    const renewed = [...bought, pay({ sessions: 8, amountCents: 8_000_000, paidAt: "2026-10-10" })];
    expect(billingStatus(pack, renewed, days(8), "2026-10-16").sessionsLeft).toBe(8);
  });
});

describe("por sesión", () => {
  const per = plan({ kind: "por_sesion", amountCents: 1_000_000, dueDay: null, startsOn: "2026-10-01" });
  it("debe las sesiones asistidas sin pagar", () => {
    const s = billingStatus(per, [pay({ sessions: 1, amountCents: 1_000_000 })], ["2026-10-02", "2026-10-09", "2026-10-14"], "2026-10-16");
    expect(s).toMatchObject({ state: "vencido", sessionsOwed: 2, amountDueCents: 2_000_000, daysLate: 7, detail: "debe 2 sesiones" });
  });
  it("al día si pagó todas", () => {
    expect(billingStatus(per, [pay({ sessions: 2, amountCents: 2_000_000 })], ["2026-10-02", "2026-10-09"], "2026-10-16").state).toBe("al_dia");
  });
});

describe("precarga y mensaje", () => {
  it("+ Registrar pago precarga el monto y el mes a cobrar", () => {
    const p = plan();
    const s = billingStatus(p, paidMonths("2026-08", "2026-09"), [], "2026-10-16");
    expect(suggestedPayment(p, s)).toEqual({ amountCents: 2_500_000, period: "2026-10", sessions: null });
  });
  it("mensaje de WhatsApp con la plantilla y el alias", () => {
    const p = plan();
    const s = billingStatus(p, paidMonths("2026-08", "2026-09"), [], "2026-10-05");
    expect(paymentReminderText(s, p, { clientName: "Martina G.", alias: "reactive.kine", today: "2026-10-05" })).toBe(
      "Hola Martina, te recordamos que la cuota de octubre ($ 25.000) vence el 10/10. Podés transferir al alias reactive.kine. ¡Gracias!",
    );
    const late = billingStatus(p, paidMonths("2026-08", "2026-09"), [], "2026-10-16");
    expect(paymentReminderText(late, p, { clientName: "Martina G.", alias: "x", today: "2026-10-16" })).toContain("venció el 10/10");
  });
});

describe("resumen del mes y exportación", () => {
  it("cobrado, pendiente, vencido y total por profe", () => {
    const payments = [pay({ clientId: "a", amountCents: 100, paidAt: "2026-10-01" }), pay({ clientId: "b", amountCents: 200, paidAt: "2026-10-02" }), pay({ clientId: "a", amountCents: 999, paidAt: "2026-09-30" })];
    const st = (state: string, amountDueCents: number) => ({ ...billingStatus(null, [], [], "2026-10-16"), state, amountDueCents }) as never;
    const s = monthSummary("2026-10", payments, [{ clientId: "a", status: st("vencido", 50) }, { clientId: "b", status: st("por_vencer", 70) }], (id) => (id === "a" ? "nico" : "caro"));
    expect(s).toEqual({
      cobradoCents: 300,
      pendienteCents: 70,
      vencidoCents: 50,
      porProfe: [
        { coachId: "caro", cobradoCents: 200, pagos: 1 },
        { coachId: "nico", cobradoCents: 100, pagos: 1 },
      ],
    });
  });
  it("CSV con «;», comillas cuando hace falta y BOM", () => {
    const rows = paymentRows([pay({ period: "2026-10", note: 'pagó "en mano"; ok' })], { client: () => "Martina G.", coach: () => "Nico R.", registeredBy: () => "Nico R." });
    const csv = toCsv(rows);
    expect(csv.startsWith("﻿Fecha;Paciente;Profe;Concepto;Monto (ARS);Medio;Nota;Registrado por")).toBe(true);
    expect(csv).toContain("2026-10-05;Martina G.;Nico R.;Cuota octubre 2026;25000;Transferencia;\"pagó \"\"en mano\"\"; ok\";Nico R.");
  });
});
