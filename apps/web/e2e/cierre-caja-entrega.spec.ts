import { test, expect, type APIRequestContext } from "@playwright/test";
import { API_URL, apiLogin, asegurarSinTurnoAbierto, asegurarTurnoAbierto } from "./helpers";

// Muchos locales usan solo Caja y nadie marca los pedidos en cocina/parrilla/
// entrega. Al cerrar caja, lo que siga pendiente del turno se da por entregado
// (menos lo anulado, que ya está cancelado).
test("al cerrar caja los pedidos pendientes del turno quedan entregados y los anulados no se tocan", async ({
  request,
}: {
  request: APIRequestContext;
}) => {
  const tokenAdmin = await apiLogin(request, "admin", "admin123");
  const tokenCajero = await apiLogin(request, "cajero", "cajero123");
  await asegurarSinTurnoAbierto(request, tokenAdmin);
  const turno = await asegurarTurnoAbierto(request, tokenAdmin);
  const auth = { Authorization: `Bearer ${tokenCajero}` };

  const menu = await (await request.get(`${API_URL}/menu`, { headers: auth })).json();
  const producto = menu.productos.find((p: { nombre: string }) => p.nombre === "Churrasco Sencillo");

  async function vender(): Promise<number> {
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
    return (await res.json()).folio;
  }

  const folioPendiente = await vender();
  const folioAnulado = await vender();
  await request.patch(`${API_URL}/pedidos/${folioAnulado}/cancelar`, { headers: auth });

  const conteo = await (
    await request.get(`${API_URL}/caja/turnos/${turno.id}/resumen`, { headers: auth })
  ).json();
  expect(conteo.pedidosSinEntregar).toBe(1);

  await request.patch(`${API_URL}/caja/turnos/${turno.id}/cerrar`, { headers: auth, data: { efectivoContado: 0 } });

  const estadoDe = async (folio: number) => {
    const lista = await (await request.get(`${API_URL}/pedidos?estado=todos`, { headers: auth })).json();
    return lista.find((p: { folio: number }) => p.folio === folio)?.estado;
  };
  expect(await estadoDe(folioPendiente)).toBe("ENTREGADO");
  expect(await estadoDe(folioAnulado)).toBe("CANCELADO");
});

test("el modal de cerrar caja avisa cuántos pedidos pendientes se marcarán como entregados", async ({
  page,
  request,
}: {
  page: import("@playwright/test").Page;
  request: APIRequestContext;
}) => {
  const tokenAdmin = await apiLogin(request, "admin", "admin123");
  const tokenCajero = await apiLogin(request, "cajero", "cajero123");
  await asegurarSinTurnoAbierto(request, tokenAdmin);
  await asegurarTurnoAbierto(request, tokenAdmin);
  const auth = { Authorization: `Bearer ${tokenCajero}` };
  const menu = await (await request.get(`${API_URL}/menu`, { headers: auth })).json();
  const producto = menu.productos.find((p: { nombre: string }) => p.nombre === "Churrasco Sencillo");
  await request.post(`${API_URL}/pedidos`, {
    headers: auth,
    data: {
      clienteNombre: "Cliente de prueba",
      tipoConsumo: "LLEVAR",
      metodoPago: "EFECTIVO",
      items: [{ productoId: producto.id, cantidad: 1, extras: [] }],
    },
  });

  await page.goto("/login");
  await page.evaluate(
    ([token]) =>
      localStorage.setItem(
        "churrasco.auth",
        JSON.stringify({ token, usuario: { id: "a", username: "admin", rol: "admin", nombre: "Admin", tieneEmpleado: false } }),
      ),
    [tokenAdmin],
  );
  await page.goto("/admin/caja-diaria");
  await page.getByRole("button", { name: "Cerrar turno" }).click();
  await expect(page.getByText(/1 pedido de este turno que sigue pendiente se marcará como entregado/)).toBeVisible();

  await asegurarSinTurnoAbierto(request, tokenAdmin);
});

test("cada ticket muestra su código único (COD) y el buscador de Admin lo encuentra", async ({
  page,
  request,
}: {
  page: import("@playwright/test").Page;
  request: APIRequestContext;
}) => {
  const tokenAdmin = await apiLogin(request, "admin", "admin123");
  const tokenCajero = await apiLogin(request, "cajero", "cajero123");
  await asegurarSinTurnoAbierto(request, tokenAdmin);
  await asegurarTurnoAbierto(request, tokenAdmin);
  const auth = { Authorization: `Bearer ${tokenCajero}` };
  const menu = await (await request.get(`${API_URL}/menu`, { headers: auth })).json();
  const producto = menu.productos.find((p: { nombre: string }) => p.nombre === "Churrasco Sencillo");
  const venta = await (
    await request.post(`${API_URL}/pedidos`, {
      headers: auth,
      data: {
        clienteNombre: "Cliente de prueba",
        tipoConsumo: "LLEVAR",
        metodoPago: "EFECTIVO",
        items: [{ productoId: producto.id, cantidad: 1, extras: [] }],
      },
    })
  ).json();

  await page.goto("/login");
  await page.evaluate(
    ([token]) =>
      localStorage.setItem(
        "churrasco.auth",
        JSON.stringify({ token, usuario: { id: "a", username: "admin", rol: "admin", nombre: "Admin", tieneEmpleado: false } }),
      ),
    [tokenAdmin],
  );
  await page.goto("/admin/pedidos");
  await expect(page.getByText(`COD${venta.folio} ·`).first()).toBeVisible();
  await page.getByPlaceholder(/buscar/i).first().fill(`cod${venta.folio}`);
  await expect(page.getByText(`COD${venta.folio} ·`)).toHaveCount(1);

  await asegurarSinTurnoAbierto(request, tokenAdmin);
});
