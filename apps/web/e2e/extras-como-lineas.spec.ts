import { test, expect } from "@playwright/test";
import { API_URL, apiLogin, asegurarSinTurnoAbierto, asegurarTurnoAbierto, loginUI } from "./helpers";

// Antes, en cocina los extras iban como texto chico debajo del plato
// ("Porción de Arroz, 2x Porción de Chorizo") y se perdían de vista. Ahora
// cada extra es una línea más, igual que un producto: con su foto y su
// cantidad, siempre con "Nx" aunque sea 1.
test("en cocina cada extra se ve como una línea propia, con su cantidad y su foto", async ({ page, request }) => {
  const tokenAdmin = await apiLogin(request, "admin", "admin123");
  await asegurarTurnoAbierto(request, tokenAdmin);
  const auth = { Authorization: `Bearer ${tokenAdmin}` };

  const menu = await (await request.get(`${API_URL}/menu`, { headers: auth })).json();
  const churrasco = menu.productos.find((p: { nombre: string }) => p.nombre === "Churrasco Sencillo");
  const arroz = menu.extras.find((e: { nombre: string }) => e.nombre === "Porción de Arroz");
  const chorizo = menu.extras.find((e: { nombre: string }) => e.nombre === "Porción de Chorizo");
  const pedido = await (
    await request.post(`${API_URL}/pedidos`, {
      headers: auth,
      data: {
        clienteNombre: "Extras en cocina",
        tipoConsumo: "LLEVAR",
        items: [
          {
            productoId: churrasco.id,
            cantidad: 1,
            extras: [
              { extraId: chorizo.id, cantidad: 1 },
              { extraId: arroz.id, cantidad: 2 },
            ],
          },
        ],
      },
    })
  ).json();

  await loginUI(page, "cocina", "cocina123");
  await page.waitForURL(/\/cocina/);

  const tarjeta = page.locator("article").filter({ hasText: "Extras en cocina" });
  await expect(tarjeta.getByText("1x Churrasco Sencillo")).toBeVisible({ timeout: 10_000 });
  await expect(tarjeta.getByText("1x Porción de Chorizo")).toBeVisible();
  await expect(tarjeta.getByText("2x Porción de Arroz")).toBeVisible();

  const fotoArroz = tarjeta.getByRole("img", { name: "Porción de Arroz" });
  await expect(fotoArroz).toHaveAttribute("src", /\/imagenes\/extras\/.+\?v=/);
  await expect.poll(() => fotoArroz.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

  await request.patch(`${API_URL}/pedidos/${pedido.folio}/cancelar`, { headers: auth });
  await asegurarSinTurnoAbierto(request, tokenAdmin);
});
