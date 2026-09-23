import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { API_URL, apiLogin, asegurarSinTurnoAbierto, loginUI } from "./helpers";

// La franja de arriba de Caja deja siempre a la vista si la caja está abierta
// (y con cuánto se abrió) o cerrada, y permite abrirla/cerrarla desde ahí.
test("el banner de Caja permite abrir y cerrar la caja y muestra el fondo inicial", async ({ page, request }) => {
  const tokenAdmin = await apiLogin(request, "admin", "admin123");
  await asegurarSinTurnoAbierto(request, tokenAdmin);

  await loginUI(page, "cajero", "cajero123");
  await page.waitForURL(/\/caja/);

  const banner = page.getByRole("status").filter({ hasText: /^Caja (abierta|cerrada)/ });
  await expect(banner).toContainText("Caja cerrada");

  await banner.getByRole("button", { name: "Abrir caja" }).click();
  await page.fill('input[name="fondoInicial"]', "150");
  await page.getByRole("button", { name: "Confirmar apertura" }).click();
  await expect(banner).toContainText("Caja abierta");
  await expect(banner).toContainText("fondo inicial Bs 150,00");

  await banner.getByRole("button", { name: "Cerrar caja" }).click();
  // Antes de contar, ya se ve cuánto debería haber en la caja.
  await expect(page.getByText("Debería haber en la caja")).toBeVisible();
  await expect(page.getByText("Bs 150,00").first()).toBeVisible();
  await page.fill('input[name="efectivoContado"]', "150");
  await expect(page.getByText("La caja cuadra exacto.")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar cierre" }).click();
  await expect(page.getByRole("heading", { name: "Caja cerrada" })).toBeVisible();
  await page.getByRole("button", { name: "Listo" }).click();
  await expect(banner).toContainText("Caja cerrada");

  // El fondo con el que se abrió queda visible en el historial de turnos.
  const turnos = await (
    await request.get(`${API_URL}/caja/turnos`, { headers: { Authorization: `Bearer ${tokenAdmin}` } })
  ).json();
  expect(turnos[0]).toMatchObject({ fondoInicial: 150, efectivoContado: 150, efectivoEsperado: 150, diferencia: 0 });
});

async function sesionAdmin(page: Page, token: string) {
  await page.goto("/login");
  await page.evaluate(
    ([t]) =>
      localStorage.setItem(
        "churrasco.auth",
        JSON.stringify({ token: t, usuario: { id: "c", username: "cajero", rol: "cajero", nombre: "Caja", tieneEmpleado: false } }),
      ),
    [token],
  );
}

// Lo que el cajero necesita al cerrar: cuánto se vendió y cuánto efectivo
// debería haber, para contar y comparar.
test("al cerrar, el resumen incluye las ventas en efectivo y dice cuánto debería haber", async ({
  page,
  request,
}: {
  page: Page;
  request: APIRequestContext;
}) => {
  const tokenAdmin = await apiLogin(request, "admin", "admin123");
  const tokenCajero = await apiLogin(request, "cajero", "cajero123");
  const auth = { Authorization: `Bearer ${tokenCajero}` };
  await asegurarSinTurnoAbierto(request, tokenAdmin);
  await request.post(`${API_URL}/caja/turnos`, { headers: auth, data: { fondoInicial: 100 } });

  const menu = await (await request.get(`${API_URL}/menu`, { headers: auth })).json();
  const producto = menu.productos.find((p: { nombre: string }) => p.nombre === "Churrasco Sencillo"); // Bs 37
  await request.post(`${API_URL}/pedidos`, {
    headers: auth,
    data: {
      clienteNombre: "Cliente de prueba",
      tipoConsumo: "LLEVAR",
      metodoPago: "EFECTIVO",
      items: [{ productoId: producto.id, cantidad: 1, extras: [] }],
    },
  });

  await sesionAdmin(page, tokenCajero);
  await page.goto("/caja");
  await page.getByRole("button", { name: "Cerrar caja" }).click();

  await expect(page.getByText("Total vendido (1 pedido)")).toBeVisible();
  await expect(page.getByText("Bs 137,00")).toBeVisible(); // 100 de fondo + 37 vendidos en efectivo

  // Si se cuenta menos, dice cuánto falta.
  await page.fill('input[name="efectivoContado"]', "100");
  await expect(page.getByText("Faltan Bs 37,00")).toBeVisible();
  await page.fill('input[name="efectivoContado"]', "137");
  await expect(page.getByText("La caja cuadra exacto.")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar cierre" }).click();
  await expect(page.getByRole("heading", { name: "Caja cerrada" })).toBeVisible();

  await asegurarSinTurnoAbierto(request, tokenAdmin);
});
