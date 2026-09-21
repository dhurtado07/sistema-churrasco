import { test, expect } from "@playwright/test";
import { apiLogin, loginUI, API_URL } from "./helpers";

// Nota: el empleado y la marca quedan registrados en la base (no hay
// endpoint para borrar un empleado ni una marca de asistencia) — se corre a
// propósito contra la base de desarrollo, no contra producción. El nombre
// "E2E" y la nota "E2E test" los dejan identificables.
test("un admin puede marcar la entrada de un empleado a mano", async ({ page, request }) => {
  const tokenAdmin = await apiLogin(request, "admin", "admin123");
  const username = `e2e_empleado_${Date.now()}`;
  await request.post(`${API_URL}/empleados`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
    data: { username, password: "e2e123456", nombre: "Empleado E2E", puesto: "Pruebas", sueldo: 1 },
  });

  await loginUI(page, "admin", "admin123");
  await page.waitForURL(/\/admin/);
  await page.goto("/admin/empleados");

  await page.click("text=Asistencia");
  // No importa cuál quede seleccionado por defecto (puede haber más de un
  // empleado en la base) — lo que se prueba es el flujo de marcar a mano,
  // no un empleado en particular.
  await page.getByRole("button", { name: /marcar entrada|marcar salida/i }).first().click();

  await page.fill('input[name="notas"]', "E2E test");
  await page.getByRole("button", { name: /^Registrar (entrada|salida)$/ }).click();

  await expect(page.getByText(/\(manual\)/)).toBeVisible();
  await expect(page.getByText("Presente").first()).toBeVisible();
});
