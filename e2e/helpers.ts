import { expect, type Page } from "@playwright/test";

export const IDS = {
  martina: "10000000-0000-4000-8000-000000000010",
  lucas: "10000000-0000-4000-8000-000000000015",
};

/** Login con el acceso rápido del modo demo. */
export async function quickLogin(page: Page, who: "Martina (cliente)" | "Nico (profe)" | "Admin") {
  await page.goto("/login");
  await page.getByRole("button", { name: who }).click();
  await page.waitForURL(who.startsWith("Martina") ? /\/app$/ : /\/coach$/);
}

/** Login con email y contraseña (formulario real). */
export async function loginWith(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Ingresar/ }).click();
}

export async function logoutClient(page: Page) {
  await page.goto("/app/perfil");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.waitForURL(/\/login$/);
}

export async function logoutCoach(page: Page) {
  await page.goto("/coach");
  await page.getByRole("button", { name: /^Menú de / }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await page.waitForURL(/\/login$/);
}

/** El Panel del profe muestra sus datos (no vacío). */
export async function expectCoachPanelLoaded(page: Page) {
  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.getByRole("link", { name: /^\s*\d+\s*Clientes activos/ })).toBeVisible();
  await expect(page.getByText("completó el Día", { exact: false }).first()).toBeVisible();
}
