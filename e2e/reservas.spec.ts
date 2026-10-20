import { expect, test } from "@playwright/test";
import { logoutClient, logoutCoach, quickLogin } from "./helpers";

// F12 · Reservas online. Lunes 19/10/2026 10:00 (Buenos Aires). Nico atiende de lunes a viernes, 8–12 y 15–19,
// turnos de 60 min, 12 h de anticipación y él confirma. El seed trae una reserva de Valentina por confirmar.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-19T10:00:00-03:00"));
});

test("la paciente reserva un horario libre y el profe lo confirma", async ({ page }) => {
  await quickLogin(page, "Martina (cliente)");
  await page.getByRole("navigation").getByRole("link", { name: "Turnos" }).click();
  await expect(page.getByRole("heading", { name: "Reservá tu turno" })).toBeVisible();
  await expect(page.getByText("Con Nico R. · Kinesiólogo deportivo")).toBeVisible();

  // Hoy no se puede (12 h de anticipación): el primer día con horarios es el martes 20/10.
  await expect(page.getByRole("radio", { name: /^lunes 19\/10: sin horarios/ })).toBeDisabled();
  await expect(page.getByRole("radio", { name: /^martes 20\/10: \d+ horarios libres/ })).toHaveAttribute("aria-checked", "true");
  // Lucas tiene 10:00 (90 min): 10 y 11 no aparecen.
  const manana = page.getByRole("radiogroup", { name: "Horarios de la mañana" });
  await expect(manana.getByRole("radio")).toHaveText(["08:00", "09:00"]);

  await manana.getByRole("radio", { name: "08:00" }).click();
  await page.getByRole("button", { name: "Reservar", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Confirmar turno" });
  await expect(confirm.getByText("Queda pendiente hasta que Nico lo confirme.")).toBeVisible();
  await confirm.getByLabel(/Algo que tu profe tenga que saber/).fill("Traigo la resonancia");
  await confirm.getByRole("button", { name: "Confirmar reserva" }).click();
  const done = page.getByRole("dialog", { name: "¡Pedido enviado!" });
  await expect(done).toBeVisible();
  await done.getByRole("button", { name: "Listo" }).click();

  // Ya no está libre y aparece en «Mis turnos» por confirmar.
  await expect(manana.getByRole("radio")).toHaveText(["09:00"]);
  const mine = page.getByRole("listitem").filter({ hasText: "mar 20/10 · 08:00" });
  await expect(mine.getByText("Por confirmar")).toBeVisible();
  await expect(mine.getByRole("button", { name: "Cancelar turno" })).toBeVisible(); // sin confirmar se puede retirar
  await logoutClient(page);

  // El profe la ve en el Panel y la confirma en la Agenda.
  await quickLogin(page, "Nico (profe)");
  await expect(page.getByRole("link", { name: /2 reservas por confirmar/ })).toBeVisible();
  await page.getByRole("link", { name: /2 reservas por confirmar/ }).click();
  await expect(page.getByRole("heading", { name: "Reservas por confirmar (2)" })).toBeVisible();
  const reserva = page.getByRole("listitem", { name: "Reserva de Martina G." });
  await expect(reserva).toContainText("Traigo la resonancia");
  await reserva.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByRole("heading", { name: "Reservas por confirmar (1)" })).toBeVisible();
  await logoutCoach(page);

  await quickLogin(page, "Martina (cliente)");
  await page.goto("/app/turnos");
  await expect(page.getByRole("listitem").filter({ hasText: "mar 20/10 · 08:00" }).getByText("Agendado")).toBeVisible();
});

test("el profe edita sus horarios; si apaga las reservas, la paciente no puede reservar", async ({ page }) => {
  await quickLogin(page, "Nico (profe)");
  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Agenda" }).click();
  await page.getByRole("link", { name: "Mis horarios" }).click();
  await expect(page.getByRole("heading", { name: "Mis horarios" })).toBeVisible();
  await expect(page.getByLabel("Lunes: desde").first()).toHaveValue("08:00");
  // Una franja que se pisa no se guarda (la nueva arranca a las 19:00; la movemos a las 18:00).
  await page.getByRole("button", { name: "Agregar franja el lunes" }).click();
  await page.getByLabel("Lunes: desde").last().fill("18:00");
  await page.getByRole("button", { name: "Guardar horarios" }).click();
  await expect(page.getByText("Lunes: hay franjas que se pisan.")).toBeVisible();
  await page.getByRole("button", { name: /Quitar franja de 18:00 a 22:00/ }).click();

  await page.getByRole("checkbox", { name: /Reservas online/ }).uncheck();
  await page.getByRole("button", { name: "Guardar horarios" }).click();
  await expect(page.getByText("Listo, guardado.")).toBeVisible();
  await logoutCoach(page);

  await quickLogin(page, "Martina (cliente)");
  await page.goto("/app/turnos");
  await expect(page.getByText("Nico todavía no habilitó las reservas online.")).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Día" })).toHaveCount(0);
});
