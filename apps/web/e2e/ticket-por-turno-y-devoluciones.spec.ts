import { test, expect, type APIRequestContext } from "@playwright/test";
import { API_URL, apiLogin, asegurarSinTurnoAbierto, asegurarTurnoAbierto } from "./helpers";

// Local que solo usa Caja (cocina, parrilla y entrega apagadas): los pedidos
// se quedan pendientes durante el turno — así una devolución se puede anular —
// y al cerrar caja todo lo pendiente pasa a entregado. Además el número de
// ticket arranca en 1 en cada turno.
test.describe("Solo Caja: devoluciones, cierre y numeración por turno", () => {
  let tokenAdmin: string;
  let tokenCajero: string;

  test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
    tokenAdmin = await apiLogin(request, "admin", "admin123");
    tokenCajero = await apiLogin(request, "cajero", "cajero123");
    await request.patch(`${API_URL}/configuracion`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      data: { cocinaHabilitada: false, parrillaHabilitada: false, entregaHabilitada: false },
    });
  });

  test.afterAll(async ({ request }: { request: APIRequestContext }) => {
    await request.patch(`${API_URL}/configuracion`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      data: { cocinaHabilitada: true, parrillaHabilitada: true, entregaHabilitada: true },
    });
    await asegurarSinTurnoAbierto(request, tokenAdmin);
  });

  async function vender(request: APIRequestContext) {
    const auth = { Authorization: `Bearer ${tokenCajero}` };
    const menu = await (await request.get(`${API_URL}/menu`, { headers: auth })).json();
    const producto = menu.productos.find((p: { nombre: string }) => p.nombre === "Churrasco Sencillo");
    const res = await request.post(`${API_URL}/pedidos`, {
      headers: auth,
      data: {
        clienteNombre: "Cliente de prueba",
        tipoConsumo: "LLEVAR",
        metodoPago: "EFECTIVO",
        items: [{ productoId: producto.id, cantidad: 1, extras: [] }],
      },
    });
    expect(res.status()).toBe(201);
    return res.json() as Promise<{ folio: number; numeroTicket: number; estado: string }>;
  }

  test("el pedido queda pendiente (se puede anular) y al cerrar caja se entrega; el ticket reinicia en 1", async ({
    request,
  }: {
    request: APIRequestContext;
  }) => {
    const auth = { Authorization: `Bearer ${tokenCajero}` };
    await asegurarSinTurnoAbierto(request, tokenAdmin);
    const turno1 = await asegurarTurnoAbierto(request, tokenAdmin);

    const a = await vender(request);
    const b = await vender(request);
    expect(a.estado).toBe("PAGADO");
    expect([a.numeroTicket, b.numeroTicket]).toEqual([1, 2]);

    // El cliente pide la devolución: como sigue pendiente, se puede anular.
    const anulado = await request.patch(`${API_URL}/pedidos/${b.folio}/cancelar`, { headers: auth });
    expect(anulado.ok()).toBe(true);

    await request.patch(`${API_URL}/caja/turnos/${turno1.id}/cerrar`, { headers: auth, data: { efectivoContado: 0 } });
    const todos = await (await request.get(`${API_URL}/pedidos?estado=todos`, { headers: auth })).json();
    const estadoDe = (folio: number) => todos.find((p: { folio: number }) => p.folio === folio)?.estado;
    expect(estadoDe(a.folio)).toBe("ENTREGADO");
    expect(estadoDe(b.folio)).toBe("CANCELADO");

    // Turno nuevo: la numeración vuelve a empezar en 1.
    await asegurarTurnoAbierto(request, tokenAdmin);
    const c = await vender(request);
    expect(c.numeroTicket).toBe(1);
    expect(c.folio).toBeGreaterThan(b.folio);
  });
});
