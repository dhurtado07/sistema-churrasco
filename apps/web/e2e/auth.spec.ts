import { test, expect } from "@playwright/test";
import { loginUI } from "./helpers";

test.describe("Login", () => {
  test("credenciales correctas llevan a la estación del rol logueado", async ({ page }) => {
    await loginUI(page, "cajero", "cajero123");
    await expect(page).toHaveURL(/\/caja/);
    await expect(page.getByText("Caja Principal")).toBeVisible();
  });

  test("credenciales incorrectas muestran un error y no navegan", async ({ page }) => {
    await loginUI(page, "cajero", "contraseña-incorrecta");
    await expect(page.getByText(/usuario o contraseña incorrectos/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("un cajero no puede entrar al panel de administración", async ({ page }) => {
    await loginUI(page, "cajero", "cajero123");
    await page.waitForURL(/\/caja/);
    await page.goto("/admin/caja-diaria");
    // ProtectedRoute lo manda a /login por no tener el rol "admin", y como
    // ya tiene una sesión válida de cajero, /login lo rebota de una a su
    // propia estación en vez de mostrarle el formulario de nuevo.
    await expect(page).toHaveURL(/\/caja/);
  });
});
