import { test, expect } from "@playwright/test";
import { loginUI } from "./helpers";

// Se auto-limpia: crea un producto descartable, lo edita y lo elimina — no
// deja residuo en la base al terminar (a diferencia de una venta real, un
// producto que nunca se vendió se puede borrar de verdad, no solo desactivar).
test("crear, editar y eliminar un producto de punta a punta", async ({ page }) => {
  const nombre = `Producto E2E ${Date.now()}`;
  const nombreEditado = `${nombre} (editado)`;

  await loginUI(page, "admin", "admin123");
  await page.waitForURL(/\/admin/);
  await page.goto("/admin/productos");

  await page.click("text=Nuevo producto");
  await page.fill('input[name="nombre"]', nombre);
  // La categoría ya viene como selector (para no duplicar "Platos"/"platos")
  // — "Platos" ya existe en el catálogo real, así que se elige esa.
  await page.selectOption('select[name="categoria"]', "Platos");
  await page.fill('input[name="precio"]', "10");
  await page.click('button:has-text("Crear producto")');

  const fila = page.locator("li", { hasText: nombre });
  await expect(fila).toBeVisible();

  await fila.getByRole("button", { name: "Editar" }).click();
  await page.fill('input[name="nombre"]', nombreEditado);
  await page.click('button:has-text("Guardar cambios")');

  const filaEditada = page.locator("li", { hasText: nombreEditado });
  await expect(filaEditada).toBeVisible();

  await filaEditada.getByRole("button", { name: "Eliminar" }).click();
  await page.getByRole("button", { name: "Sí, eliminar" }).click();

  await expect(page.locator("li", { hasText: nombreEditado })).toHaveCount(0);
});
