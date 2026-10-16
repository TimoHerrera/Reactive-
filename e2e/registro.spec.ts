import { expect, test } from "@playwright/test";
import { IDS, logoutClient, quickLogin } from "./helpers";

// F8 · Registro real: al marcar un ejercicio aparece «¿Cómo te fue?» (opcional); el profe lo ve en la ficha.
test("Martina registra series y RPE (o saltea) → Nico lo ve en «Registro» y en la actividad", async ({ page }) => {
  // Lunes: el seed deja el Día A hecho hoy y el Día B (de la semana pasada) sin hacer en esta semana.
  await page.clock.setFixedTime(new Date("2026-10-19T10:00:00"));
  await quickLogin(page, "Martina (cliente)");
  await page.getByRole("navigation").getByRole("link", { name: "Mi Rutina" }).click();
  await page.getByRole("button", { name: /Día B/ }).click();

  // El objetivo de esfuerzo tiene su explicación.
  const cards = page.locator("article");
  await expect(cards.first()).toBeVisible();

  // 1) Marcar con registro.
  const first = cards.nth(0);
  const firstName = (await first.locator(".text-title-sm").first().textContent())!.trim();
  await first.getByRole("button", { name: /como hecho/ }).click();
  const sheet = page.getByRole("dialog", { name: "¿Cómo te fue?" });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("RPE serie 1").selectOption("9");
  await sheet.getByLabel("Comentario").fill("Me costó la última");
  await sheet.getByRole("button", { name: "Guardar y marcar" }).click();
  await expect(sheet).toBeHidden();
  await expect(first.getByRole("button", { name: /^Desmarcar/ })).toBeVisible();

  // 2) Saltear: queda hecho igual, sin registro.
  const second = cards.nth(1);
  await second.getByRole("button", { name: /como hecho/ }).click();
  await page.getByRole("dialog", { name: "¿Cómo te fue?" }).getByRole("button", { name: "Saltear" }).click();
  await expect(second.getByRole("button", { name: /^Desmarcar/ })).toBeVisible();

  // 3) Desmarcar es directo (sin panel).
  await second.getByRole("button", { name: /^Desmarcar/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(second.getByRole("button", { name: /como hecho/ })).toBeVisible();

  // El profe ve planificado vs. hecho y la alerta del seed (goblet RPE 9 con objetivo 7).
  await logoutClient(page);
  await quickLogin(page, "Nico (profe)");
  await expect(page.getByText("Martina marcó RPE 9 en Sentadilla goblet (objetivo 7)")).toBeVisible();
  await page.goto(`/coach/clientes/${IDS.martina}?tab=registro`);
  await expect(page.getByText("RPE ↑ 9 (obj. 7)")).toBeVisible();
  const dayB = page.getByRole("region", { name: /^Día B del lun 19\// });
  await expect(dayB.getByText(firstName)).toBeVisible();
  await expect(dayB.getByText(/S1 .*RPE 9/)).toBeVisible();
  await expect(dayB.getByText("«Me costó la última»")).toBeVisible();
});

test("la card muestra RPE/RIR objetivo con su explicación", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-19T10:00:00"));
  await quickLogin(page, "Martina (cliente)");
  await page.getByRole("navigation").getByRole("link", { name: "Mi Rutina" }).click();
  await page.getByRole("button", { name: /Día A/ }).click();
  await expect(page.getByText("RPE 7 · RIR 3")).toBeVisible();
  await page.getByRole("button", { name: "¿Qué es RPE y RIR?" }).first().click();
  await expect(page.getByText("RPE: qué tan duro fue, de 1 a 10. RIR: cuántas repeticiones te quedaron en el tanque.")).toBeVisible();
});
