import { expect, test } from "@playwright/test";
import { quickLogin } from "./helpers";

// «Grabar con la cámara» con la grabadora de la página.
// El Chromium «headless shell» de Playwright no tiene cámara (NotSupportedError): se usa el Chrome
// instalado, con un perfil temporal y una cámara simulada.
test.use({ channel: "chrome", launchOptions: { args: ["--use-fake-device-for-media-stream"] } });

test.describe("con el permiso ya dado", () => {
  test.use({ permissions: ["camera", "microphone"] });

  test("graba, revisa y usa el video: queda cargado como si se hubiera subido", async ({ page }) => {
    await quickLogin(page, "Nico (profe)");
    await page.goto("/coach/ejercicios/nuevo");
    await page.getByRole("button", { name: "Grabar con la cámara" }).click();

    const dialog = page.getByRole("dialog", { name: "Grabar video" });
    await expect(dialog.getByLabel("Imagen de la cámara")).toBeVisible();
    await dialog.getByRole("button", { name: "Empezar a grabar" }).click();
    await expect(dialog.getByRole("timer")).toContainText("/ 1:00");
    await page.waitForTimeout(1500);
    await dialog.getByRole("button", { name: "Detener grabación" }).click();

    await expect(dialog.getByLabel("Video grabado")).toBeVisible();
    await dialog.getByRole("button", { name: "Usar este video" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Vista previa")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("sin permiso todavía", () => {
  test("muestra «Habilitar cámara» y, al permitir, abre la cámara", async ({ page, context }) => {
    await quickLogin(page, "Nico (profe)");
    await page.goto("/coach/ejercicios/nuevo");
    await page.getByRole("button", { name: "Grabar con la cámara" }).click();
    const dialog = page.getByRole("dialog", { name: "Grabar video" });
    await expect(dialog.getByText("te va a pedir permiso para usar la cámara")).toBeVisible();
    // La persona toca «Permitir» en el aviso del navegador.
    await context.grantPermissions(["camera", "microphone"]);
    await dialog.getByRole("button", { name: "Habilitar cámara" }).click();
    await expect(dialog.getByLabel("Imagen de la cámara")).toBeVisible();
    await dialog.getByRole("button", { name: "Cerrar" }).click();
    await expect(dialog).toHaveCount(0);
  });
});

test.describe("permiso bloqueado", () => {
  test("explica cómo habilitarla y ofrece la app de cámara o elegir un video", async ({ page, context }) => {
    await context.clearPermissions();
    await quickLogin(page, "Nico (profe)");
    await page.goto("/coach/ejercicios/nuevo");
    await page.getByRole("button", { name: "Grabar con la cámara" }).click();
    const dialog = page.getByRole("dialog", { name: "Grabar video" });
    const enable = dialog.getByRole("button", { name: "Habilitar cámara" });
    if (await enable.isVisible()) await enable.click(); // Chromium sin UI falsa rechaza el pedido
    await expect(dialog.getByRole("alert")).toContainText("La cámara está bloqueada para esta página.");
    await expect(dialog.getByText("Cómo habilitarla")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Usar la app de cámara del celular" })).toBeVisible(); // Pixel 7
    await expect(dialog.getByRole("button", { name: "Elegir un video ya grabado" })).toBeVisible();
  });
});
