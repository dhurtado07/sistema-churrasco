import { test, expect } from "@playwright/test";
import { API_URL, apiLogin, asegurarSinTurnoAbierto, asegurarTurnoAbierto, loginUI } from "./helpers";

// Caso real: la laptop de caja perdió la conexión un rato (wifi, suspensión)
// y mientras tanto cocina y parrilla terminaron el pedido. Los avisos en vivo
// de ese rato se pierden; si la lista no se recarga al volver la conexión,
// sigue ofreciendo "Anular" y el servidor responde "Este pedido ya no está
// pendiente, no se puede modificar".
test("al volver la conexión, Caja no ofrece anular un pedido que ya terminaron cocina y parrilla", async ({
  page,
  request,
}) => {
  const tokenAdmin = await apiLogin(request, "admin", "admin123");
  await asegurarTurnoAbierto(request, tokenAdmin);
  const auth = { Authorization: `Bearer ${tokenAdmin}` };

  const menu = await (await request.get(`${API_URL}/menu`, { headers: auth })).json();
  const churrasco = menu.productos.find((p: { nombre: string }) => p.nombre === "Churrasco Sencillo");
  const pedido = await (
    await request.post(`${API_URL}/pedidos`, {
      headers: auth,
      data: {
        clienteNombre: "Reconexión",
        tipoConsumo: "LLEVAR",
        items: [{ productoId: churrasco.id, cantidad: 1 }],
      },
    })
  ).json();

  await loginUI(page, "cajero", "cajero123");
  await page.waitForURL(/\/caja/);
  await page.getByRole("button", { name: /pedidos pendientes/i }).click();
  const fila = page.locator("li", { hasText: `Ticket #${pedido.numeroTicket}` }).filter({ hasText: "Reconexión" });
  await expect(fila.getByRole("button", { name: "Anular" })).toBeVisible({ timeout: 10_000 });

  // Con la lista abierta, como en la caja real: nada de recargar a mano.
  await page.context().setOffline(true);
  await request.patch(`${API_URL}/pedidos/${pedido.folio}/cocina-lista`, { headers: auth });
  await request.patch(`${API_URL}/pedidos/${pedido.folio}/parrilla-lista`, { headers: auth });
  await page.context().setOffline(false);

  await expect(fila).toHaveCount(0, { timeout: 15_000 });

  await asegurarSinTurnoAbierto(request, tokenAdmin);
});
