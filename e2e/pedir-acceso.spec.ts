import { expect, test } from "@playwright/test";
import { loginWith, logoutCoach, quickLogin } from "./helpers";

// «Primera vez»: pedir acceso → el profe aprueba → activación (link simulado en mock) → Hoy vacío → login.
test("una persona nueva pide acceso, el profe la aprueba y activa su cuenta", async ({ page }) => {
  const email = `e2e.${Date.now()}@test.com`;
  const password = "clave-e2e-123";

  await page.goto("/login");
  await page.getByRole("link", { name: /¿Primera vez\?/ }).click();
  await expect(page).toHaveURL(/\/solicitar-acceso$/);

  // Cuenta existente → aviso
  await page.getByLabel("Nombre y apellido").fill("Prueba Existente");
  await page.getByLabel("Email").fill("martina@reactive.test");
  await page.getByLabel("WhatsApp").fill("11 5555 0100");
  await page.getByRole("button", { name: /Pedir acceso/ }).click();
  await expect(page.getByText("Ya tenés cuenta: ingresá o recuperá tu contraseña.")).toBeVisible();

  // Pedido nuevo
  await page.getByLabel("Nombre y apellido").fill("Juana Prueba");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Tu profe").selectOption({ label: "Nico R. · Kinesiólogo deportivo" });
  await page.getByRole("button", { name: "Postquirúrgico" }).click();
  await page.getByRole("button", { name: /Pedir acceso/ }).click();
  await expect(page.getByRole("heading", { name: "¡Listo!" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Escribinos por WhatsApp" })).toHaveAttribute("href", "https://wa.link/tk8wy7");

  // El profe la ve en el Panel y la aprueba
  await quickLogin(page, "Nico (profe)");
  // Paula (lo eligió) + la nueva. La de Diego («Todavía no tengo») la ve solo el admin.
  await expect(page.getByText(/Solicitudes de acceso \(2\)/)).toBeVisible();
  await page.getByRole("link", { name: /Solicitudes de acceso/ }).click();
  const card = page.getByRole("listitem").filter({ hasText: "Juana Prueba" });
  await card.getByRole("button", { name: "Aprobar e invitar" }).click();
  const link = await card.getByLabel("Link de activación").inputValue();
  expect(link).toMatch(/\/activar\?token=/);

  // Activación: crea la contraseña y entra a Hoy (vacío, todavía sin rutina)
  await logoutCoach(page);
  await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(page.getByRole("heading", { name: /Creá tu\s*contraseña/i })).toBeVisible();
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Repetila").fill(password);
  await page.getByRole("button", { name: /Entrar a mi rutina/ }).click();
  await page.waitForURL(/\/app$/);
  await expect(page.getByText(/Tu profe todavía no\s*cargó tu rutina/i)).toBeVisible();

  // Puede volver a entrar con su contraseña
  await page.goto("/app/perfil");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.waitForURL(/\/login$/);
  await loginWith(page, email, password);
  await page.waitForURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Hola, Juana" })).toBeVisible();
});
