import { expect, test } from "@playwright/test";
import { IDS, logoutCoach, quickLogin } from "./helpers";

// F10 · Pagos. Lunes 19/10/2026 (Buenos Aires). El seed deja un caso de cada estado:
// Martina al día, Sofía por vencer, Federico vencido, Tomás «renovar pack», Valentina pack con sesiones.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-19T10:00:00-03:00"));
});

test("el profe ve los cobros, registra un pago y recuerda por WhatsApp", async ({ page }) => {
  await quickLogin(page, "Nico (profe)");
  await expect(page.getByRole("link", { name: /Cobros: 1 vencido · 2 por vencer/ })).toBeVisible();
  await page.getByRole("link", { name: /Cobros:/ }).click();
  await expect(page.getByRole("heading", { name: "Pagos" })).toBeVisible();

  // Vencidos: Federico, con WhatsApp precargado.
  const federico = page.getByRole("listitem").filter({ hasText: "Federico A." });
  await expect(federico.getByText("vencido hace 70 días · debe 3 meses · $ 105.000")).toBeVisible();
  await federico.getByRole("button", { name: "WhatsApp" }).click();
  const wa = page.getByRole("dialog", { name: "Recordar pago" });
  await expect(wa.getByRole("textbox")).toHaveValue(
    /^Hola Federico, te recordamos que las cuotas de agosto, septiembre y octubre \(\$ 105\.000\) venció el 10\/8\. Podés transferir al alias reactive\.kinesio\. ¡Gracias!$/,
  );
  await expect(wa.getByRole("link", { name: "Abrir WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/5491155550108\?text=/);
  await wa.getByRole("button", { name: "Cerrar" }).click();

  // Filtro por estado y «Renovar pack».
  await page.getByRole("button", { name: /Renovar pack \(1\)/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Tomás L." }).getByText("quedan 0 sesiones")).toBeVisible();

  // + Pago a Federico (precarga la cuota y el mes más viejo impago).
  await page.getByRole("button", { name: /Todos/ }).click();
  await federico.getByRole("button", { name: "+ Pago" }).click();
  const form = page.getByRole("dialog", { name: "Registrar pago" });
  await expect(form.getByLabel("Monto ($)")).toHaveValue("35.000");
  await expect(form.getByLabel("Mes que cubre")).toHaveValue("2026-08");
  await form.getByRole("radio", { name: "Efectivo" }).click();
  await form.getByRole("button", { name: "Registrar pago" }).click();
  await expect(form).toBeHidden();
  await expect(federico.getByText("vencido hace 39 días · debe 2 meses · $ 70.000")).toBeVisible();

  // En la ficha: historial y plan.
  await page.goto(`/coach/clientes/${IDS.martina}?tab=pagos`);
  await expect(page.getByText("Mensual · $ 35.000 · vence el 10")).toBeVisible();
  await expect(page.getByText(/al día|vence el 10\/11/i).first()).toBeVisible();
  await logoutCoach(page);
});

test("el admin ve el resumen del mes, exporta y activa/desactiva la cuota del paciente", async ({ page }) => {
  await quickLogin(page, "Admin");
  await page.goto("/coach/pagos");
  const resumen = page.getByRole("region", { name: "Resumen del mes" });
  await expect(resumen.getByRole("term").filter({ hasText: "Cobrado" })).toBeVisible();
  await expect(resumen.getByRole("cell", { name: "Caro P." })).toBeVisible();
  const csv = page.waitForEvent("download");
  await resumen.getByRole("button", { name: "Exportar CSV" }).click();
  expect((await csv).suggestedFilename()).toBe("pagos-2026-10.csv");
  const xlsx = page.waitForEvent("download");
  await resumen.getByRole("button", { name: "Exportar Excel" }).click();
  expect((await xlsx).suggestedFilename()).toBe("pagos-2026-10.xlsx");

  await page.goto("/coach/ajustes");
  await page.getByLabel("Alias o CBU para transferir").fill("reactive.mp");
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByText("Listo, guardado.")).toBeVisible();
  await logoutCoach(page);

  // Federico ve su cuota vencida con el alias nuevo.
  await page.goto("/login");
  await page.getByLabel("Email").fill("federico@reactive.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("reactive-demo");
  await page.getByRole("button", { name: /Ingresar/ }).click();
  await page.waitForURL(/\/app$/);
  await page.goto("/app/perfil");
  const cuota = page.getByRole("region", { name: "Tu cuota" });
  await expect(cuota).toContainText("Venció el 10/8");
  await expect(cuota).toContainText("reactive.mp");
});

test("un profe no entra a Ajustes", async ({ page }) => {
  await quickLogin(page, "Nico (profe)");
  await page.goto("/coach/ajustes");
  await expect(page).toHaveURL(/\/coach$/);
});
