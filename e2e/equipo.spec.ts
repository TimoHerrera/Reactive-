import { expect, test, type Page } from "@playwright/test";
import { expectNewCoachPanel, logoutCoach, quickLogin } from "./helpers";

const path = (url: string) => url.replace(/^https?:\/\/[^/]+/, "");

async function openEquipo(page: Page) {
  await quickLogin(page, "Admin");
  await page.getByRole("link", { name: /Equipo · profes y accesos/ }).click();
  await expect(page).toHaveURL(/\/coach\/equipo$/);
  await expect(page.getByRole("heading", { name: "Equipo" })).toBeVisible();
}

// El admin invita a un profe → el profe activa su cuenta con el link → ve el Panel.
test("el admin invita a un profe y el profe activa su cuenta", async ({ page }) => {
  const email = `profe.${Date.now()}@test.com`;
  await openEquipo(page);
  await expect(page.getByRole("link", { name: /Lu M\..*Invitación pendiente/ })).toBeVisible();

  await page.getByRole("link", { name: "+ Profe" }).click();
  await page.getByLabel("Nombre").fill("Juli Prueba");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Título").fill("Kinesióloga");
  await page.getByLabel("WhatsApp").fill("+54 9 11 5555-0199");
  await page.getByRole("button", { name: /Enviar invitación/ }).click();
  await expect(page.getByRole("heading", { name: "Invitación enviada" })).toBeVisible();
  const link = (await page.getByTestId("activation-link").textContent())!.trim();
  expect(link).toMatch(/\/activar\?token=/);

  await page.getByRole("link", { name: /Ver ficha/ }).click();
  await expect(page.getByText("Invitación pendiente")).toBeVisible();

  await logoutCoach(page);
  await page.goto(path(link));
  await expect(page.getByRole("heading", { name: /Creá tu\s*contraseña/ })).toBeVisible();
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-juli-123");
  await page.getByLabel("Repetila").fill("clave-juli-123");
  await page.getByRole("button", { name: /Entrar al panel/ }).click();
  await expectNewCoachPanel(page);

  // Un profe no ve ni puede entrar a «Equipo».
  await expect(page.getByRole("link", { name: /Equipo · profes/ })).toHaveCount(0);
  await page.goto("/coach/equipo");
  await expect(page).toHaveURL(/\/coach$/);

  // El admin la ve activa.
  await logoutCoach(page);
  await openEquipo(page);
  await expect(page.getByRole("link", { name: /Juli Prueba.*Activo/ })).toBeVisible();
});

test("activación con código de invitación (cuando el mail no llega)", async ({ page }) => {
  await openEquipo(page);
  await page.getByRole("link", { name: /Lu M\./ }).click();
  await page.getByRole("button", { name: "Generar código" }).click();
  const code = (await page.getByTestId("invite-code").textContent())!.trim();
  expect(code).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/);

  await logoutCoach(page);
  await page.getByRole("link", { name: /código de invitación/ }).click();
  await expect(page).toHaveURL(/\/activar\?codigo/);
  await page.getByLabel("Email").fill("lu@reactive.test");
  await page.getByLabel("Código", { exact: true }).fill(code.toLowerCase());
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-lu-1234");
  await page.getByLabel("Repetila").fill("clave-lu-1234");
  await page.getByRole("button", { name: /Activar y entrar/ }).click();
  await expectNewCoachPanel(page);
});

test("un profe no puede entrar a Equipo", async ({ page }) => {
  await quickLogin(page, "Nico (profe)");
  await page.getByRole("button", { name: /^Menú de / }).click();
  await expect(page.getByRole("menuitem", { name: "Mi perfil" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Equipo" })).toHaveCount(0);
  await page.goto("/coach/equipo");
  await expect(page).toHaveURL(/\/coach$/);
  await page.goto("/coach/equipo/nuevo");
  await expect(page).toHaveURL(/\/coach$/);
});
