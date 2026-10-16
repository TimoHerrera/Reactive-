import { expect, test } from "@playwright/test";
import { logoutClient, logoutCoach, quickLogin } from "./helpers";

// F9 · Agenda. Lunes 19/10/2026 10:00 (hora de Buenos Aires): el seed arma los turnos alrededor de «hoy».
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-19T10:00:00-03:00"));
});

test("el profe agenda un turno recurrente, ve la superposición y marca asistencia", async ({ page }) => {
  await quickLogin(page, "Nico (profe)");
  await expect(page.getByRole("link", { name: /Hoy: 3 turnos/ })).toBeVisible();
  await expect(page.getByText(/reprogramación pedida/).first()).toBeVisible();

  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Agenda" }).click();
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
  await expect(page.getByRole("article", { name: /18:00 · Martina G\./ })).toBeVisible();

  // + Turno a las 18:30 → se pisa con Martina.
  await page.getByRole("button", { name: "+ Turno" }).click();
  const form = page.getByRole("dialog", { name: "Nuevo turno" });
  await form.getByLabel("Paciente").selectOption({ label: "Lucas B." });
  await form.getByLabel("Hora").fill("18:30");
  await expect(form.getByRole("alert")).toContainText("Se superpone");
  await expect(form.getByRole("alert")).toContainText("Martina G.");

  // Mejor a las 15:00, lunes y jueves, 2 semanas → 4 turnos.
  await form.getByLabel("Hora").fill("15:00");
  await expect(form.getByRole("alert")).toHaveCount(0);
  await form.getByText("Repetir").click();
  await form.getByRole("button", { name: "jueves" }).click();
  await form.getByLabel("Semanas").fill("2");
  await expect(form.getByText(/Se crean 4 turnos/)).toBeVisible();
  await form.getByRole("button", { name: "Agendar 4 turnos" }).click();
  await expect(form).toBeHidden();
  await expect(page.getByRole("article", { name: /15:00 · Lucas B\./ })).toBeVisible();

  // Semana: los turnos del jueves.
  await page.getByRole("tab", { name: "Semana" }).click();
  await expect(page.getByText("Semana del lun 19/10 al dom 25/10")).toBeVisible();

  // Tomás (09:00) ya pasó: asistió.
  await page.getByRole("tab", { name: "Día" }).click();
  const tomas = page.getByRole("article", { name: /09:00 · Tomás L\./ });
  await tomas.getByRole("button", { name: "Asistió" }).click();
  await expect(tomas.getByText("Asistió", { exact: true })).toBeVisible();

  // Recordatorio de mañana por WhatsApp (teléfono normalizado a 549…).
  const manana = page.getByRole("region", { name: "Turnos de mañana" });
  await manana.getByRole("listitem").filter({ hasText: "Sofía R." }).getByRole("button", { name: "WhatsApp" }).click();
  const wa = page.getByRole("dialog", { name: "Recordar turno" });
  await expect(wa.getByRole("textbox")).toHaveValue(/¡Hola Sofía! Te recordamos tu turno de MEP Sport mañana martes 20\/10 a las 17:00 en Reactive\. ¿Nos confirmás\? 💪/);
  await expect(wa.getByRole("link", { name: "Abrir WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/5491155550111\?text=/);
});

test("la paciente ve su próximo turno, lo agrega al calendario y pide reprogramar → el profe lo ve", async ({ page }) => {
  await quickLogin(page, "Martina (cliente)");
  const card = page.getByRole("region", { name: "Próximo turno" });
  await expect(card).toContainText("lun 19/10 · 18:00 · Kinesiología con Nico R.");

  const download = page.waitForEvent("download");
  await card.getByRole("button", { name: "Agregar a mi calendario" }).click();
  expect((await download).suggestedFilename()).toBe("turno-reactive-2026-10-19.ics");

  await card.getByRole("button", { name: "Pedir reprogramar" }).click();
  const sheet = page.getByRole("dialog", { name: "Pedir reprogramar" });
  await sheet.getByLabel("Motivo").fill("Viaje por trabajo");
  await sheet.getByLabel("¿Qué franja te queda mejor?").fill("Martes a la tarde");
  await sheet.getByRole("button", { name: "Enviar a mi profe" }).click();
  await expect(card.getByText("Reprogramación pedida")).toBeVisible();

  await page.goto("/app/perfil");
  await expect(page.getByRole("region", { name: "Próximos turnos" })).toContainText("lun 19/10 · 18:00");

  await logoutClient(page);
  await quickLogin(page, "Nico (profe)");
  await expect(page.getByText("2 reprogramaciones pedidas")).toBeVisible();
  await page.goto("/coach/agenda");
  await expect(page.getByRole("region", { name: /Reprogramaciones pedidas/ })).toContainText("prefiere Martes a la tarde");
  await logoutCoach(page);
});

test("visibilidad: Caro solo ve los turnos de su paciente", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("caro@reactive.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("reactive-demo");
  await page.getByRole("button", { name: /Ingresar/ }).click();
  await page.waitForURL(/\/coach$/);
  await page.goto("/coach/agenda?vista=semana");
  await expect(page.getByText(/Bruno S\./).first()).toBeVisible();
  await expect(page.getByText(/Martina G\./)).toHaveCount(0);
});
