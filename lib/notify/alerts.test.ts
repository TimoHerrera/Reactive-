import { describe, expect, it } from "vitest";
import { buildBillingRows } from "@/lib/billing/rows";
import type { Appointment, ClientPlan, NotificationPrefs, Payment, Profile, Role } from "@/lib/data/types";
import { buildAlerts, defaultPrefs, describeRule, since, validatePrefs } from "./alerts";

const TODAY = "2026-10-16";
const NICO = { id: "nico", role: "coach" as const };
const ADMIN = { id: "admin", role: "admin" as const };

const person = (id: string, fullName: string, coachId: string): Profile => ({
  id,
  role: "client",
  fullName,
  email: `${id}@test`,
  phone: null,
  title: null,
  sport: null,
  caseType: null,
  caseDetail: null,
  goal: null,
  coachId,
  clientSince: null,
  createdAt: "",
  bio: null,
  avatarPath: null,
  activatedAt: "",
  disabledAt: null,
});
const plan = (clientId: string, p: Partial<ClientPlan> = {}): ClientPlan => ({
  clientId,
  kind: "mensual",
  amountCents: 3_000_000,
  dueDay: 10,
  packSessions: null,
  startsOn: "2026-08-01",
  active: true,
  updatedAt: "",
  ...p,
});
let n = 0;
const pay = (clientId: string, p: Partial<Payment>): Payment => ({
  id: `p${++n}`,
  clientId,
  amountCents: 3_000_000,
  paidAt: "2026-08-05",
  method: "transferencia",
  period: null,
  sessions: null,
  note: null,
  registeredBy: null,
  createdAt: "",
  ...p,
});
const appt = (clientId: string, p: Partial<Appointment>): Appointment => ({
  id: `a${++n}`,
  clientId,
  coachId: "nico",
  startsAt: "2026-10-20T21:00:00.000Z",
  durationMin: 60,
  type: "kinesiologia",
  status: "agendado",
  notes: null,
  seriesId: null,
  createdBy: null,
  createdAt: "",
  rescheduleReason: null,
  reschedulePreference: null,
  rescheduleRequestedAt: null,
  ...p,
});
const prefs = (p: Partial<NotificationPrefs> = {}): NotificationPrefs => ({ ...defaultPrefs("coach"), ...p });

/** Sofía vence el 19 (en 3 días), Federico debe desde el 10/9, Tomás terminó su pack, Bruno es de Caro y debe. */
function fixture() {
  const clients = [
    person("sofia", "Sofía Gómez", "nico"),
    person("fede", "Federico Paz", "nico"),
    person("tomas", "Tomás Ruiz", "nico"),
    person("bruno", "Bruno Díaz", "caro"),
  ];
  const plans = [
    plan("sofia", { dueDay: 19 }),
    plan("fede"),
    plan("tomas", { kind: "pack", dueDay: null, packSessions: 4, amountCents: 10_000_000, startsOn: "2026-09-01" }),
    plan("bruno"),
  ];
  const payments = [
    ...["2026-08", "2026-09"].map((period) => pay("sofia", { period })),
    pay("fede", { period: "2026-08" }),
    pay("tomas", { sessions: 4, amountCents: 10_000_000, paidAt: "2026-09-01" }),
  ];
  const attended = ["2026-09-03", "2026-09-10", "2026-09-17", "2026-09-24"].map((d) => appt("tomas", { status: "asistio", startsAt: `${d}T21:00:00.000Z` }));
  return { clients, plans, payments, appointments: attended };
}

const alertsFor = (p: NotificationPrefs, me: { id: string; role: Role } = NICO, extra: Appointment[] = []) => {
  const f = fixture();
  const rows = buildBillingRows(f, TODAY);
  return buildAlerts({ rows, appointments: [...f.appointments, ...extra], prefs: p, me, today: TODAY });
};

describe("avisos del profe", () => {
  it("con las preferencias de fábrica: por vencer, sin pagar y pack terminado; solo de sus pacientes", () => {
    const alerts = alertsFor(prefs());
    expect(alerts.map((a) => a.kind).sort()).toEqual(["pack", "vence", "vencido"]);
    expect(alerts.every((a) => a.clientId !== "bruno")).toBe(true);
    const vence = alerts.find((a) => a.kind === "vence")!;
    expect(vence.title).toBe("A Sofía Gómez le vence la cuota en 3 días");
    expect(vence.detail).toBe("La cuota de octubre · $ 30.000 · vence el 19/10");
    expect(vence.href).toBe("/coach/clientes/sofia?tab=pagos");
  });

  it("«N días antes»: con 2 días todavía no avisa; con 3, sí", () => {
    expect(alertsFor(prefs({ dueSoonDays: 2 })).some((a) => a.kind === "vence")).toBe(false);
    expect(alertsFor(prefs({ dueSoonDays: 3 })).some((a) => a.kind === "vence")).toBe(true);
  });

  it("vencido: espera los días elegidos y la clave cambia con cada repetición", () => {
    // Federico debe septiembre (venció el 10/9 → 36 días de atraso).
    const once = alertsFor(prefs({ overdueAfterDays: 1, overdueRepeatDays: null })).find((a) => a.kind === "vencido")!;
    expect(once.title).toBe("Federico Paz no pagó");
    expect(once.key).toBe("vencido:fede:2026-09-10:0");
    expect(once.date).toBe("2026-09-11");

    const weekly = alertsFor(prefs({ overdueAfterDays: 1, overdueRepeatDays: 7 })).find((a) => a.kind === "vencido")!;
    // (36 − 1) / 7 = 5 repeticiones → la última el 11/9 + 35 días = 16/10 (hoy).
    expect(weekly.key).toBe("vencido:fede:2026-09-10:5");
    expect(weekly.date).toBe("2026-10-16");
    expect(weekly.title).toBe("Federico Paz sigue sin pagar");
    expect(weekly.detail).toBe("Las cuotas de septiembre y octubre · $ 60.000 · vencido hace 36 días · debe 2 meses");

    expect(alertsFor(prefs({ overdueAfterDays: 40 })).some((a) => a.kind === "vencido")).toBe(false);
  });

  it("pack: avisa con el umbral elegido y la clave cambia al comprar otro", () => {
    const pack = alertsFor(prefs({ packLowSessions: 0 })).find((a) => a.kind === "pack")!;
    expect(pack.title).toBe("Tomás Ruiz terminó su pack");
    expect(pack.key).toBe("pack:tomas:4:0");
  });

  it("cada aviso se puede apagar", () => {
    const off = prefs({ dueSoonEnabled: false, overdueEnabled: false, packLowEnabled: false, rescheduleEnabled: false });
    expect(alertsFor(off)).toEqual([]);
  });

  it("reprogramaciones de sus pacientes", () => {
    const req = appt("sofia", { status: "reprogramacion_pedida", rescheduleReason: "Examen", rescheduleRequestedAt: "2026-10-15T15:00:00.000Z" });
    const alert = alertsFor(prefs(), NICO, [req]).find((a) => a.kind === "reprogramacion")!;
    expect(alert.title).toBe("Sofía pidió cambiar un turno");
    expect(alert.detail).toBe("20/10 18:00 · «Examen»");
    expect(alert.href).toBe("/coach/agenda?fecha=2026-10-20");
    expect(alertsFor(prefs({ rescheduleEnabled: false }), NICO, [req]).some((a) => a.kind === "reprogramacion")).toBe(false);
  });

  it("admin: todo el centro o solo sus pacientes", () => {
    expect(alertsFor({ ...defaultPrefs("admin") }, ADMIN).some((a) => a.clientId === "bruno")).toBe(true);
    expect(alertsFor({ ...defaultPrefs("admin"), scope: "mine" }, ADMIN)).toEqual([]);
    // Un profe no ve los de otro aunque ponga «all».
    expect(alertsFor(prefs({ scope: "all" })).some((a) => a.clientId === "bruno")).toBe(false);
  });

  it("valida los números", () => {
    const base = defaultPrefs("coach");
    expect(validatePrefs(base)).toBeNull();
    expect(validatePrefs({ ...base, dueSoonDays: 0 })).toMatch(/1 a 60/);
    expect(validatePrefs({ ...base, overdueAfterDays: 2.5 })).toMatch(/0 a 90/);
    expect(validatePrefs({ ...base, overdueRepeatDays: 0 })).toMatch(/1 a 60/);
    expect(validatePrefs({ ...base, packLowSessions: 11 })).toMatch(/0 a 10/);
  });

  it("textos de las reglas", () => {
    const p = prefs({ dueSoonDays: 1, overdueAfterDays: 0, overdueRepeatDays: null, packLowSessions: 2 });
    expect(describeRule("vence", p)).toBe("1 día antes del vencimiento");
    expect(describeRule("vencido", p)).toBe("el mismo día que vence, una sola vez");
    expect(describeRule("vencido", prefs())).toBe("1 día después de vencer y cada 7 días mientras siga sin pagar");
    expect(describeRule("pack", p)).toBe("cuando quedan 2 sesiones o menos");
    expect(since("2026-10-16", TODAY)).toBe("hoy");
    expect(since("2026-10-15", TODAY)).toBe("ayer");
    expect(since("2026-10-10", TODAY)).toBe("hace 6 días");
  });
});
