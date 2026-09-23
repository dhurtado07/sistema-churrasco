import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiLogin, asegurarSinTurnoAbierto, asegurarTurnoAbierto, loginUI } from "./helpers";

// Cubre la regla de negocio más importante de Caja: no se puede cobrar sin
// un turno abierto (antes de este arreglo, una venta sin turno se registraba
// igual y esa plata quedaba fuera de cualquier cierre de caja).
test.describe("Caja: turno de caja y venta", () => {
  let tokenAdmin: string;

  test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
    // Un solo login de admin para toda la suite — el login en sí (con
    // rate-limit real) ya lo cubre auth.spec.ts, acá solo hace falta el
    // token para preparar/limpiar el turno entre tests.
    tokenAdmin = await apiLogin(request, "admin", "admin123");
  });

  test("no se puede cobrar sin un turno de caja abierto", async ({ page, request }) => {
    await asegurarSinTurnoAbierto(request, tokenAdmin);

    await loginUI(page, "cajero", "cajero123");
    await page.waitForURL(/\/caja/);

    await expect(page.getByText(/no hay un turno de caja abierto/i)).toBeVisible();

    await page.click("text=Churrasco Sencillo");
    await expect(page.getByRole("button", { name: /marcar como pagado/i })).toBeDisabled();
  });

  test("con un turno abierto, se puede completar una venta de punta a punta", async ({ page, request }) => {
    const turno = await asegurarTurnoAbierto(request, tokenAdmin);

    await loginUI(page, "cajero", "cajero123");
    await page.waitForURL(/\/caja/);

    await expect(page.getByText(/no hay un turno de caja abierto/i)).not.toBeVisible();

    await page.click("text=Churrasco Sencillo");
    // El nombre del cliente es obligatorio para cobrar (ver CajaPage#cobrar).
    await page.fill('input[placeholder="Nombre del cliente"]', "Cliente de prueba");
    // "Para llevar" evita el requisito de número de mesa — lo que importa acá
    // es probar el gate del turno, no el flujo de mesa.
    await page.click("text=Para llevar");
    const botonCobrar = page.getByRole("button", { name: /marcar como pagado/i });
    await expect(botonCobrar).toBeEnabled();
    await botonCobrar.click();

    // Modal de confirmación ("¿Confirmás el pedido?") antes de cobrar de verdad.
    await page.getByRole("button", { name: "Sí" }).click();

    // El ticket se abre con un folio de pedido real — confirma que la venta
    // se registró en el servidor, no solo que el botón respondió.
    await expect(page.getByText(/^Ticket #\d+$/)).toBeVisible({ timeout: 10_000 });

    await request.patch(`http://localhost:3050/caja/turnos/${turno.id}/cerrar`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      data: { efectivoContado: 0 },
    });
  });

  test.afterAll(async ({ request }: { request: APIRequestContext }) => {
    // Nunca dejar un turno abierto colgado para el resto de la suite ni para
    // quien siga probando el sistema a mano después.
    await asegurarSinTurnoAbierto(request, tokenAdmin);
  });
});
