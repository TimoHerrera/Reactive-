import { expect, test } from "@playwright/test";
import { expectCoachPanelLoaded, logoutClient, logoutCoach, quickLogin } from "./helpers";

// Bug reportado: tras «cliente → logout → profe» el Panel aparecía vacío. Se prueba en los dos sentidos y varias veces.
test("cliente → logout → profe: el Panel muestra los datos del profe", async ({ page }) => {
  for (let i = 0; i < 3; i++) {
    await quickLogin(page, "Martina (cliente)");
    await expect(page.getByRole("heading", { name: "Hola, Martina" })).toBeVisible();
    await logoutClient(page);

    await quickLogin(page, "Nico (profe)");
    await expectCoachPanelLoaded(page);
    await page.getByRole("navigation").getByRole("link", { name: "Clientes" }).click();
    await expect(page.getByRole("button", { name: /Todos\s*8/ })).toBeVisible();
    await logoutCoach(page);
  }
});

test("profe → logout → cliente: ve su rutina y nada del profe", async ({ page }) => {
  await quickLogin(page, "Nico (profe)");
  await expectCoachPanelLoaded(page);
  await logoutCoach(page);

  await quickLogin(page, "Martina (cliente)");
  await page.getByRole("navigation").getByRole("link", { name: "Mi Rutina" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Readaptación – Fase 2" })).toBeVisible();
  await expect(page.getByText("Clientes activos")).toHaveCount(0);
  await expect(page.getByText("Viendo como")).toHaveCount(0);
  // Y no puede entrar al área del profe
  await page.goto("/coach");
  await expect(page).toHaveURL(/\/app$/);
});
