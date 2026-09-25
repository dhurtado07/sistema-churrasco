import { test, expect } from "@playwright/test";
import { loginUI } from "./helpers";

// Antes, al entrar a cocina/parrilla la pantalla decía "No hay pedidos
// pendientes." mientras todavía se estaban descargando, y recién unos segundos
// después aparecían los pedidos: quien miraba creía que no había nada que
// preparar. Ahora, hasta que el servidor responde, dice que está cargando.

test("cocina muestra 'Cargando pedidos…' (no 'No hay pedidos') mientras la cola no llegó", async ({ page }) => {
  let liberar: () => void = () => {};
  const respuestaRetenida = new Promise<void>((resolve) => (liberar = resolve));
  await page.route("**/pedidos/cola?estacion=cocina", async (route) => {
    await respuestaRetenida;
    await route.continue();
  });

  await loginUI(page, "cocina", "cocina123");
  await page.waitForURL(/\/cocina/);

  await expect(page.getByText("Cargando pedidos…")).toBeVisible();
  await expect(page.getByText("No hay pedidos pendientes.")).not.toBeVisible();

  liberar();
  await expect(page.getByText("Cargando pedidos…")).not.toBeVisible({ timeout: 10_000 });
});

test("si la cola no se puede cargar, avisa que está reintentando y se recupera sola", async ({ page }) => {
  let fallar = true;
  await page.route("**/pedidos/cola?estacion=cocina", (route) => (fallar ? route.abort() : route.continue()));

  await loginUI(page, "cocina", "cocina123");
  await page.waitForURL(/\/cocina/);

  await expect(page.getByText(/reintentando/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("No hay pedidos pendientes.")).not.toBeVisible();

  fallar = false;
  await expect(page.getByText(/reintentando/)).not.toBeVisible({ timeout: 10_000 });
});
