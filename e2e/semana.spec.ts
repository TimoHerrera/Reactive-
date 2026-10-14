import { expect, test } from "@playwright/test";
import { quickLogin } from "./helpers";

// Semana a semana (lunes a domingo): lo completado una semana no aparece hecho la siguiente,
// aunque la app haya quedado abierta de un día para el otro.
test("domingo con el día completo → el lunes, al volver a la app, aparece sin hacer", async ({ page }) => {
  // Domingo 18/10/2026 a la tarde (el seed arma la semana de Martina con el día A hecho «hoy»).
  await page.clock.setFixedTime(new Date("2026-10-18T19:00:00"));
  await quickLogin(page, "Martina (cliente)");
  await page.getByRole("navigation").getByRole("link", { name: "Mi Rutina" }).click();
  await expect(page.getByRole("button", { name: /Día A/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("¡Día completo!")).toBeVisible();

  // Pasa la noche con la app abierta; el lunes vuelve a la pantalla.
  await page.clock.setFixedTime(new Date("2026-10-19T08:30:00"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText(/^0 de \d+ hechos$/)).toBeVisible();
  await expect(page.getByText("¡Día completo!")).toHaveCount(0);
});
