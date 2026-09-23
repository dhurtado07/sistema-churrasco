import { test, expect } from "@playwright/test";
import { apiLogin, asegurarSinTurnoAbierto, asegurarTurnoAbierto, loginUI } from "./helpers";

// Antes usaba el confirm() nativo del navegador (feo, y algunos navegadores
// móviles/PWA lo bloquean o no muestran bien) — ahora es un modal propio de
// la app, con el detalle del pedido y un botón rojo de confirmación.
test("anular un pedido desde Caja usa el modal de confirmación de la app, no el del navegador", async ({
  page,
  request,
}) => {
  const tokenAdmin = await apiLogin(request, "admin", "admin123");
  await asegurarTurnoAbierto(request, tokenAdmin);

  await loginUI(page, "cajero", "cajero123");
  await page.waitForURL(/\/caja/);
  await page.waitForTimeout(500);

  await page.click("text=Churrasco Sencillo");
  await page.fill('input[placeholder="Nombre del cliente"]', "Cliente de prueba");
  await page.click("text=Para llevar");
  await page.getByRole("button", { name: /marcar como pagado/i }).click();
  await page.getByRole("button", { name: "Sí" }).click();
  const tituloTicket = page.getByText(/^Ticket #\d+$/);
  await expect(tituloTicket).toBeVisible({ timeout: 10_000 });
  const folio = (await tituloTicket.textContent())!.replace("Ticket #", "").trim();
  await page.getByRole("button", { name: "Nuevo pedido" }).click();

  // La lista de "Pedidos pendientes" se carga una vez al montar la página y
  // después solo se actualiza vía WebSocket — recargar asegura tener la
  // lista fresca en vez de depender del timing de ese evento.
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /pedidos pendientes/i }).click();
  await expect(page.getByRole("heading", { name: "Pedidos pendientes" })).toBeVisible();
  const filaPedido = page.locator("li", { hasText: `Ticket #${folio}` });
  await expect(filaPedido).toBeVisible({ timeout: 10_000 });
  await filaPedido.getByRole("button", { name: "Anular" }).click();

  // Es el modal propio de la app (con el detalle del pedido), no un dialog()
  // nativo del navegador — si fuera el nativo, este texto no existiría en el DOM.
  await expect(page.getByText("Anular pedido")).toBeVisible();
  await expect(page.getByText(`¿Anular el ticket #${folio}?`)).toBeVisible();
  await page.getByRole("button", { name: "Sí, anular" }).click();

  await expect(page.getByText("Anular pedido")).not.toBeVisible();
  await expect(page.getByText(`#${folio}`)).not.toBeVisible();

  await asegurarSinTurnoAbierto(request, tokenAdmin);
});
