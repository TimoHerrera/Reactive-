import { expect, type Page } from "@playwright/test";

export const IDS = {
  martina: "10000000-0000-4000-8000-000000000010",
  lucas: "10000000-0000-4000-8000-000000000015",
  bruno: "10000000-0000-4000-8000-000000000018",
  /** «Readaptación – Fase 2» de Martina (de Nico). */
  martinaRoutine: "30000000-0000-4000-8000-000000000001",
  /** Plantilla «Pretemporada base» (de Nico, compartida). */
  pretemporada: "30000000-0000-4000-8000-000000000009",
};

/** Contraseña de los usuarios del seed (modo demo). */
export const DEMO_PASSWORD = "reactive-demo";

/** El admin invita a un profe desde Equipo y el profe activa su cuenta con el link (termina logueado como el profe). */
export async function inviteAndActivateCoach(page: Page, name: string, email: string, password: string) {
  await quickLogin(page, "Admin");
  await page.goto("/coach/equipo/nuevo");
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: /Enviar invitación/ }).click();
  const link = (await page.getByTestId("activation-link").textContent())!.trim();
  await logoutCoach(page);
  await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Repetila").fill(password);
  await page.getByRole("button", { name: /Entrar al panel/ }).click();
  await expect(page).toHaveURL(/\/coach$/);
}

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

/** Panel de un profe recién activado: carga bien, todavía sin clientes propios. */
export async function expectNewCoachPanel(page: Page) {
  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.getByRole("heading", { name: "Panel" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^\s*0\s*Clientes activos/ })).toBeVisible();
}

/** El Panel del profe muestra sus datos (no vacío). */
export async function expectCoachPanelLoaded(page: Page) {
  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.getByRole("link", { name: /^\s*\d+\s*Clientes activos/ })).toBeVisible();
  await expect(page.getByText("completó el Día", { exact: false }).first()).toBeVisible();
}
