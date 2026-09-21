import { test, expect } from "@playwright/test";
import { API_URL, apiLogin, asegurarSinTurnoAbierto, asegurarTurnoAbierto, loginUI } from "./helpers";

// Bug real reportado por el negocio: tocar el mismo extra una segunda vez lo
// sacaba del pedido en vez de sumar una segunda unidad — un cliente que
// pedía 2 porciones de arroz terminaba sin ninguna, y se cobraba de menos.
test("pedir el mismo extra dos veces suma cantidad, no lo saca", async ({ page, request }) => {
  const tokenAdmin = await apiLogin(request, "admin", "admin123");
  const turno = await asegurarTurnoAbierto(request, tokenAdmin);

  await loginUI(page, "cajero", "cajero123");
  await page.waitForURL(/\/caja/);
  await page.waitForTimeout(500);

  await page.click("text=Churrasco Sencillo"); // Bs 37
  await page.click("text=Extras");
  await page.click("text=Porción de Arroz"); // Bs 8 x1
  await page.click("text=Porción de Arroz"); // Bs 8 x2 -- antes esto lo sacaba

  await page.click("text=Platos");
  await expect(page.getByText("Bs 53,00").first()).toBeVisible(); // 37 + 8*2

  await page.click("text=Para llevar");
  await page.getByRole("button", { name: /marcar como pagado/i }).click();
  await page.getByRole("button", { name: "Sí" }).click();
  await expect(page.getByText(/^Ticket #\d+$/)).toBeVisible({ timeout: 10_000 });

  const movimientos = await (
    await request.get(`${API_URL}/caja/movimientos?turnoId=${turno.id}`, { headers: { Authorization: `Bearer ${tokenAdmin}` } })
  ).json();
  const venta = movimientos.find((m: { categoria: string }) => m.categoria === "VENTA");
  expect(venta.monto).toBe(53);

  await asegurarSinTurnoAbierto(request, tokenAdmin);
});
