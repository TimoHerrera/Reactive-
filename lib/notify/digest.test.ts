import { describe, expect, it } from "vitest";
import type { ClientPlan, Payment, Profile } from "@/lib/data/types";
import { defaultPrefs } from "./alerts";
import { planDigests } from "./digest";
import { digestEmail } from "./email";

const TODAY = "2026-10-16";
const profile = (id: string, p: Partial<Profile>): Profile => ({
  id,
  role: "client",
  fullName: id,
  email: `${id}@test`,
  phone: null,
  title: null,
  sport: null,
  caseType: null,
  caseDetail: null,
  goal: null,
  coachId: null,
  clientSince: null,
  createdAt: "",
  bio: null,
  avatarPath: null,
  activatedAt: "",
  disabledAt: null,
  ...p,
});
const plan = (clientId: string): ClientPlan => ({ clientId, kind: "mensual", amountCents: 3_000_000, dueDay: 10, packSessions: null, startsOn: "2026-09-01", active: true, updatedAt: "" });
const paid = (clientId: string, period: string): Payment => ({
  id: `${clientId}-${period}`,
  clientId,
  amountCents: 3_000_000,
  paidAt: `${period}-05`,
  method: "efectivo",
  period,
  sessions: null,
  note: null,
  registeredBy: null,
  createdAt: "",
});

// Fede (de Nico) y Bruno (de Caro) deben octubre (venció el 10/10, 6 días).
const profiles = [
  profile("nico", { role: "coach", fullName: "Nico Rossi" }),
  profile("caro", { role: "coach", fullName: "Caro Pérez" }),
  profile("lu", { role: "coach", fullName: "Lu M.", disabledAt: "2026-10-01" }),
  profile("admin", { role: "admin", fullName: "Admin" }),
  profile("fede", { coachId: "nico", fullName: "Federico Paz" }),
  profile("bruno", { coachId: "caro", fullName: "Bruno Díaz" }),
];
const base = {
  profiles,
  plans: [plan("fede"), plan("bruno")],
  payments: [paid("fede", "2026-09"), paid("bruno", "2026-09")],
  appointments: [],
  today: TODAY,
};
const withMail = { ...defaultPrefs("coach"), emailEnabled: true };

describe("mail diario de avisos", () => {
  it("solo a quien activó el mail, con sus pacientes, y sin lo que ya vio o ya le llegó", () => {
    const prefs = new Map([
      ["nico", withMail],
      ["caro", { ...withMail, emailEnabled: false }],
      ["lu", withMail],
      ["admin", { ...defaultPrefs("admin"), emailEnabled: true }],
    ]);
    const out = planDigests({ ...base, prefs, state: [] });
    expect(out.map((d) => [d.user.id, d.alerts.map((a) => a.clientId)])).toEqual([
      ["nico", ["fede"]],
      ["admin", ["bruno", "fede"]],
    ]);

    const key = out[0]!.alerts[0]!.key;
    const again = planDigests({ ...base, prefs, state: [{ userId: "nico", key, seenAt: null, emailedAt: "2026-10-15T12:00:00Z" }] });
    expect(again.map((d) => d.user.id)).toEqual(["admin"]);
    const seen = planDigests({ ...base, prefs, state: [{ userId: "nico", key, seenAt: "2026-10-15T12:00:00Z", emailedAt: null }] });
    expect(seen.map((d) => d.user.id)).toEqual(["admin"]);
  });

  it("arma el mail con links y escapa el texto", () => {
    const prefs = new Map([["nico", withMail]]);
    const [d] = planDigests({ ...base, prefs, state: [] });
    const mail = digestEmail(d!.alerts, { name: "Nico Rossi", siteUrl: "https://reactive.app" });
    expect(mail.subject).toBe("Reactive · Federico Paz no pagó");
    expect(mail.text).toContain("Hola Nico:");
    expect(mail.text).toContain("https://reactive.app/coach/clientes/fede?tab=pagos");
    expect(mail.html).toContain("https://reactive.app/coach/avisos/configurar");

    const many = digestEmail([d!.alerts[0]!, { ...d!.alerts[0]!, key: "x", title: "<b>Ana</b> & Co" }], { name: "Nico", siteUrl: "https://reactive.app" });
    expect(many.subject).toBe("Reactive · 2 avisos nuevos");
    expect(many.html).toContain("&lt;b&gt;Ana&lt;/b&gt; &amp; Co");
  });
});
