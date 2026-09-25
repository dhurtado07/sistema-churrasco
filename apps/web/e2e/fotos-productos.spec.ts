import { test, expect } from "@playwright/test";
import { loginUI } from "./helpers";

// Las fotos ya no viajan dentro del JSON del menú/pedidos: se cargan desde
// /imagenes/... de la API, que está en otro origen que la web. Si el servidor
// no permitiera esa carga (o la ruta se rompiera), la app mostraría el ícono
// de respaldo en silencio — este test lo detecta.
test("las fotos del menú de Caja se descargan y se ven", async ({ page }) => {
  await loginUI(page, "cajero", "cajero123");
  await page.waitForURL(/\/caja/);

  const foto = page.getByRole("img", { name: "Churrasco Sencillo" }).first();
  await expect(foto).toBeVisible({ timeout: 10_000 });
  await expect(foto).toHaveAttribute("src", /\/imagenes\/productos\/.+\?v=/);
  await expect.poll(() => foto.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});
