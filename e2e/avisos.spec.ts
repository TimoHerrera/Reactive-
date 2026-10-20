import { expect, test } from "@playwright/test";
import { logoutCoach, quickLogin } from "./helpers";

// F11 · Avisos del profe. Lunes 19/10/2026 (Buenos Aires). Con los avisos de fábrica, Nico tiene 5:
// Sofía (vence en 3 días), Federico (sin pagar), Tomás (terminó el pack), Joaquín (pidió reprogramar)
// y Valentina (reservó online un turno por confirmar, F12).
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-19T10:00:00-03:00"));
});

test("el profe ve sus avisos, los marca como vistos y elige cuándo le llegan", async ({ page }) => {
  await quickLogin(page, "Nico (profe)");
  await page.getByRole("link", { name: "Avisos: 5 nuevos" }).click();
  await expect(page.getByRole("heading", { name: "Avisos" })).toBeVisible();
  await expect(page.getByText("5 nuevos")).toBeVisible();
  await expect(page.getByRole("button", { name: /Valentina reservó un turno/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /A Sofía R\. le vence la cuota en 3 días/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Federico A\. sigue sin pagar/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Tomás L\. terminó su pack/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Joaquín pidió cambiar un turno/ })).toBeVisible();

  // Tocar un aviso lo marca como visto y lleva a la ficha (pestaña Pagos).
  await page.getByRole("button", { name: /Federico A\. sigue sin pagar/ }).click();
  await expect(page).toHaveURL(/\/coach\/clientes\/.+\?tab=pagos$/);
  await page.goto("/coach/avisos");
  await expect(page.getByText("4 nuevos")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vistos" })).toBeVisible();

  // Mis avisos: avisar 2 días antes (Sofía vence en 3 → todavía no) y sin reprogramaciones.
  await page.getByRole("link", { name: "Configurar mis avisos" }).click();
  await expect(page.getByRole("heading", { name: "Mis avisos" })).toBeVisible();
  await expect(page.getByText("Con esta configuración, hoy tendrías 5 avisos.")).toBeVisible();
  await page.getByRole("button", { name: "Menos días antes" }).click();
  await expect(page.getByLabel("días antes", { exact: true })).toHaveValue("2");
  await page.getByRole("checkbox", { name: /Pedidos de reprogramación/ }).uncheck();
  await expect(page.getByText("Con esta configuración, hoy tendrías 3 avisos.")).toBeVisible();
  await expect(page.getByText("Cuota por vencer: 2 días antes del vencimiento.")).toBeVisible();
  // Venció y no pagó: a los 3 días y sin repetir.
  await page.getByLabel("días después", { exact: true }).fill("3");
  await page.getByRole("checkbox", { name: "Repetir mientras siga sin pagar" }).uncheck();
  await expect(page.getByText("Sin pagar: 3 días después de vencer, una sola vez.")).toBeVisible();
  await page.getByRole("button", { name: "Guardar mis avisos" }).click();
  await expect(page.getByText("Listo, guardado.")).toBeVisible();

  // Se mantiene al volver; Federico es un aviso nuevo (otra regla → otra clave).
  await page.reload();
  await expect(page.getByLabel("días antes", { exact: true })).toHaveValue("2");
  await page.goto("/coach/avisos");
  await expect(page.getByText("3 nuevos")).toBeVisible();
  await expect(page.getByRole("button", { name: /Sofía/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Federico A\. no pagó/ })).toBeVisible();

  await page.getByRole("button", { name: "Marcar todos como vistos" }).click();
  await expect(page.getByText("Estás al día.")).toBeVisible();
  await page.goto("/coach");
  await expect(page.getByRole("link", { name: "Avisos", exact: true })).toBeVisible();
});

test("los avisos son de cada profe: lo que configura Nico no cambia los del admin", async ({ page }) => {
  await quickLogin(page, "Nico (profe)");
  await page.goto("/coach/avisos/configurar");
  await page.getByRole("checkbox", { name: /Cuota por vencer/ }).uncheck();
  await page.getByRole("button", { name: "Guardar mis avisos" }).click();
  await expect(page.getByText("Listo, guardado.")).toBeVisible();

  // El admin, con «Todo el centro», ve también el de Sofía (es de Nico).
  await logoutCoach(page);
  await quickLogin(page, "Admin");
  await page.goto("/coach/avisos/configurar");
  await expect(page.getByRole("radio", { name: "Todo el centro" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("checkbox", { name: /Cuota por vencer/ })).toBeChecked();
  await page.goto("/coach/avisos");
  await expect(page.getByRole("button", { name: /A Sofía R\. le vence la cuota/ })).toBeVisible();
});
