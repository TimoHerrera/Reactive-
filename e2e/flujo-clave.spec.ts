import path from "node:path";
import { expect, test } from "@playwright/test";
import { IDS, logoutCoach, quickLogin } from "./helpers";

// Flujo clave: el profe importa un Excel → publica → la clienta ve la rutina → abre el video → vuelve
// al mismo día y a la misma posición de scroll.
test("profe importa un Excel, publica y la clienta lo ve con su video", async ({ page }) => {
  await quickLogin(page, "Nico (profe)");

  // 1) Importar la planilla de ejemplo para Martina
  await page.goto(`/coach/rutinas/nueva/importar?cliente=${IDS.martina}`);
  await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "../docs/ejemplos/readaptacion_martina_f2.xlsx"));
  await expect(page.getByRole("heading", { name: "Vista previa" })).toBeVisible({ timeout: 20_000 });

  // Casos del diseño: 2 a revisar y 1 no encontrado
  await expect(page.getByText("«RDL c/ mancuernas»", { exact: true })).toBeVisible();
  await expect(page.getByText("«Copenhague»", { exact: true })).toBeVisible();
  await expect(page.getByText("«Salto al cajón unipodal»", { exact: true })).toBeVisible();
  const card = (text: string) => page.getByRole("listitem").filter({ hasText: text });
  await card("«RDL c/ mancuernas»").getByRole("button", { name: "Vincular a Peso muerto rumano" }).click();
  await expect(card("«RDL c/ mancuernas»")).toHaveCount(0);
  await card("«Copenhague»").getByRole("button", { name: "Vincular a Copenhagen plank" }).click();
  await expect(card("«Copenhague»")).toHaveCount(0);
  await card("«Salto al cajón unipodal»").getByRole("button", { name: "Dejar sin vincular" }).click();
  await expect(page.getByText("¡Todo vinculado!")).toBeVisible();

  // 2) Asignar y publicar (Martina viene preseleccionada)
  await page.getByRole("button", { name: /Asignar a cliente/ }).click();
  await expect(page.getByRole("heading", { name: "Último paso" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Martina G\./ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: /^Publicar/ }).click();
  await expect(page.getByRole("heading", { name: "Rutina publicada" })).toBeVisible();
  await expect(page.getByText("Martina ya la puede ver.")).toBeVisible();

  // 3) La clienta ve la rutina
  await logoutCoach(page);
  await quickLogin(page, "Martina (cliente)");
  await page.getByRole("navigation").getByRole("link", { name: "Mi Rutina" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Readaptacion martina f2" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Día A/ })).toHaveAttribute("aria-pressed", "true");

  // 4) Abre el video de «Sentadilla goblet» desde la rutina (scrolleando hasta la card)
  const link = page.getByRole("link", { name: /Sentadilla goblet/ });
  await link.scrollIntoViewIfNeeded();
  // scrollBy es sincrónico (mouse.wheel se aplica después y la medición quedaba corrida 120 px).
  await page.evaluate(() => window.scrollBy(0, 120));
  const scrollBefore = await page.evaluate(() => Math.round(window.scrollY));
  expect(scrollBefore).toBeGreaterThan(0);
  await link.click();
  await expect(page).toHaveURL(/\/app\/ejercicios\/.+from=rutina/);
  await expect(page.getByRole("heading", { level: 1, name: "Sentadilla goblet" })).toBeVisible();
  await expect(page.getByText("Tu serie de hoy · Día A")).toBeVisible();

  // 5) Vuelve: mismo día y misma posición de scroll
  await page.getByRole("button", { name: /Volver a mi rutina/ }).last().click();
  await expect(page).toHaveURL(/\/app\/rutina\?dia=/);
  await expect(page.getByRole("button", { name: /Día A/ })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(scrollBefore - 10);
  expect(Math.abs((await page.evaluate(() => Math.round(window.scrollY))) - scrollBefore)).toBeLessThanOrEqual(10);
});
