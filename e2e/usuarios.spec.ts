import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, IDS, loginWith, logoutCoach, quickLogin } from "./helpers";

// Un email = una persona, desactivar y eliminar usuarios.

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => void d.accept()); // confirmaciones de «Desactivar» y «Restablecer»
});

test("email repetido (sin importar mayúsculas): no se crea y ofrece «Ver ficha»", async ({ page }) => {
  await quickLogin(page, "Nico (profe)");
  await page.goto("/coach/clientes/nuevo");
  await page.getByLabel("Nombre y apellido").fill("Martina Duplicada");
  await page.getByLabel("Email").fill("  MARTINA@Reactive.test ");
  await page.getByRole("button", { name: /Guardar|Crear|Invitar/ }).last().click();
  const alert = page.getByRole("alert").filter({ hasText: "Ya existe un usuario con ese email" });
  await expect(alert).toBeVisible();
  await alert.getByRole("link", { name: /Ver ficha/ }).click();
  await expect(page).toHaveURL(new RegExp(`/coach/clientes/${IDS.martina}$`));
  await expect(page.getByRole("heading", { name: "Martina G." })).toBeVisible();
});

test("el profe desactiva a su cliente: no entra, se oculta y vuelve con «Reactivar»", async ({ page }) => {
  await quickLogin(page, "Nico (profe)");
  await page.goto(`/coach/clientes/${IDS.martina}`);
  await page.getByRole("button", { name: "Desactivar" }).click();
  await expect(page.getByRole("button", { name: "Reactivar" })).toBeVisible();
  // Un profe no puede eliminar definitivamente.
  await expect(page.getByRole("button", { name: "Eliminar definitivamente" })).toHaveCount(0);

  await page.goto("/coach/clientes");
  await expect(page.getByRole("link", { name: /Sofía R\./ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Martina G\./ })).toHaveCount(0);
  await page.getByRole("button", { name: /^Desactivados/ }).click();
  await expect(page.getByRole("link", { name: /Martina G\./ })).toBeVisible();
  await logoutCoach(page);

  await loginWith(page, "martina@reactive.test", DEMO_PASSWORD);
  await expect(page.getByText("Tu acceso está desactivado. Hablá con Reactive.")).toBeVisible();

  await quickLogin(page, "Nico (profe)");
  await page.goto(`/coach/clientes/${IDS.martina}`);
  await page.getByRole("button", { name: "Reactivar" }).click();
  await expect(page.getByRole("button", { name: "Desactivar" })).toBeVisible();
  await logoutCoach(page);
  await loginWith(page, "martina@reactive.test", DEMO_PASSWORD);
  await page.waitForURL(/\/app$/);
});

test("el admin elimina un cliente escribiendo su nombre; el email queda libre; restablecer demo lo trae de vuelta", async ({ page }) => {
  await quickLogin(page, "Admin");
  await page.goto(`/coach/clientes/${IDS.lucas}`);
  await page.getByRole("button", { name: "Eliminar definitivamente" }).click();
  const confirm = page.getByRole("group", { name: "Eliminar definitivamente" });
  const del = confirm.getByRole("button", { name: "Eliminar", exact: true });
  await confirm.getByLabel(/Escribí «Lucas B\.»/).fill("Lucas");
  await expect(del).toBeDisabled();
  await confirm.getByLabel(/Escribí «Lucas B\.»/).fill("lucas b.");
  await del.click();
  await expect(page).toHaveURL(/\/coach\/clientes$/);
  await expect(page.getByRole("link", { name: /Lucas B\./ })).toHaveCount(0);

  // La cuenta ya no existe (no puede entrar)
  await logoutCoach(page);
  await loginWith(page, "lucas@reactive.test", DEMO_PASSWORD);
  await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();

  // Restablecer datos de demo (admin)
  await quickLogin(page, "Admin");
  await page.getByRole("button", { name: /^Menú de / }).click();
  // Ya estamos en /coach: hay que esperar la recarga que hace el reset (si no, el goto la pisa).
  const reloaded = page.waitForEvent("framenavigated");
  await page.getByRole("menuitem", { name: "Restablecer datos de demo" }).click();
  await reloaded;
  await page.waitForLoadState("load");
  await page.goto("/coach/clientes");
  await expect(page.getByRole("link", { name: /Lucas B\./ })).toBeVisible();
});

test("eliminar a un profe con clientes exige reasignarlos", async ({ page }) => {
  await quickLogin(page, "Admin");
  await page.goto("/coach/equipo");
  await page.getByRole("link", { name: /Caro P\./ }).click();
  await page.getByRole("button", { name: "Eliminar definitivamente" }).click();
  const confirm = page.getByRole("group", { name: "Eliminar definitivamente" });
  await confirm.getByLabel(/Escribí «Caro P\.»/).fill("Caro P.");
  const del = confirm.getByRole("button", { name: "Eliminar", exact: true });
  await expect(del).toBeDisabled(); // falta elegir a quién pasar a Bruno
  await confirm.getByLabel(/Pasar sus 1 clientes a/).selectOption({ label: "Nico R." });
  await del.click();
  await expect(page).toHaveURL(/\/coach\/equipo$/);
  await expect(page.getByRole("link", { name: /Caro P\./ })).toHaveCount(0);
  await page.goto("/coach/clientes");
  await expect(page.getByRole("link", { name: /Bruno S\./ })).toContainText("Nico R.");
});
