import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, IDS, inviteAndActivateCoach, loginWith, logoutClient, logoutCoach, quickLogin } from "./helpers";

// Cada profe ve solo lo suyo. Nico tiene 8 clientes; Caro, a Bruno; Jano es nuevo (lo invita el admin).

test("Nico carga una rutina → la clienta ve «Cargada por Nico R.»", async ({ page }) => {
  await quickLogin(page, "Nico (profe)");
  // Plantilla compartida «Pretemporada base» → Lucas (sin rutina)
  await page.goto(`/coach/rutinas/${IDS.pretemporada}/usar?cliente=${IDS.lucas}`);
  await page.getByRole("button", { name: /Siguiente: días y ejercicios/ }).click();
  await expect(page.getByText(/Paso 2 de 3/i)).toBeVisible();
  await page.getByRole("button", { name: /^Siguiente/ }).click();
  await expect(page.getByRole("heading", { name: "Último paso" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Lucas B\./ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: /^Publicar/ }).click();
  await expect(page.getByRole("heading", { name: "Rutina publicada" })).toBeVisible();
  await logoutCoach(page);

  await loginWith(page, "lucas@reactive.test", DEMO_PASSWORD);
  await page.waitForURL(/\/app$/);
  await page.getByRole("navigation").getByRole("link", { name: "Mi Rutina" }).click();
  await expect(page.getByTestId("routine-author")).toContainText("Cargada por Nico R.");
  await expect(page.getByTestId("routine-author")).not.toContainText("editada");
  await logoutClient(page);
});

test("Jano no ve los clientes de Nico ni los abre por URL, pero usa ejercicios y plantillas", async ({ page }) => {
  await inviteAndActivateCoach(page, "Jano Prueba", `jano.${Date.now()}@test.com`, "clave-jano-123");

  // Panel y Clientes: vacíos (no son sus clientes)
  await expect(page.getByRole("link", { name: /^\s*0\s*Clientes activos/ })).toBeVisible();
  await page.goto("/coach/clientes");
  await expect(page.getByText("Todavía no cargaste clientes.")).toBeVisible();
  await expect(page.getByText("Martina G.")).toHaveCount(0);

  // Por URL: «No tenés acceso»
  await page.goto(`/coach/clientes/${IDS.martina}`);
  await expect(page.getByRole("alert").filter({ hasText: "No tenés acceso" })).toContainText("No tenés acceso");
  await page.goto(`/coach/rutinas/${IDS.martinaRoutine}/editar`);
  await expect(page.getByRole("alert").filter({ hasText: "No tenés acceso" })).toContainText("No tenés acceso");
  await page.goto(`/app?como=${IDS.martina}`);
  await expect(page.getByRole("alert").filter({ hasText: "No tenés acceso" })).toContainText("No tenés acceso");

  // Compartido: biblioteca de ejercicios y plantillas (usar sí, editar no)
  await page.goto("/coach/ejercicios");
  await expect(page.getByText("Sentadilla goblet").first()).toBeVisible();
  await page.goto("/coach/rutinas?tab=plantillas");
  await expect(page.getByRole("heading", { name: "Pretemporada base" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Usar plantilla" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar Pretemporada base" })).toHaveCount(0);
  await page.goto(`/coach/rutinas/${IDS.pretemporada}/editar`);
  await expect(page.getByRole("alert").filter({ hasText: "No tenés acceso" })).toContainText("la edita solo quien la creó");
});

test("el admin ve a todos y filtra por profe", async ({ page }) => {
  await quickLogin(page, "Admin");
  await page.goto("/coach/clientes");
  const filtro = page.getByRole("group", { name: "Filtrar por profe" });
  await expect(filtro).toBeVisible();
  await expect(page.getByRole("link", { name: /Martina G\./ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Bruno S\./ })).toBeVisible();

  await filtro.getByRole("button", { name: "Caro P." }).click();
  await expect(page.getByRole("link", { name: /Bruno S\./ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Martina G\./ })).toHaveCount(0);

  // El filtro se comparte con Rutinas y el Panel
  await page.goto("/coach/rutinas");
  await expect(page.getByRole("heading", { name: "Fuerza general" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Readaptación – Fase 2" })).toHaveCount(0);
  await page.goto("/coach");
  await expect(page.getByRole("link", { name: /^\s*1\s*Clientes activos/ })).toBeVisible();

  await page.getByRole("group", { name: "Filtrar por profe" }).getByRole("button", { name: "Todos" }).click();
  await expect(page.getByRole("link", { name: /^\s*7\s*Clientes activos/ })).toBeVisible();
});
