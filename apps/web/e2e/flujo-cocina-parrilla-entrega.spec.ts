import { test, expect, type APIRequestContext } from "@playwright/test";
import { API_URL, apiLogin, asegurarTurnoAbierto, asegurarSinTurnoAbierto, loginUI } from "./helpers";

// Cubre el recorrido completo de un pedido a través de las 4 estaciones —
// antes de este test, un pedido listo para entregar mostraba el botón como
// "Entregado" (pasado) en vez de "Entregar" (la acción pendiente), lo cual
// confundía al staff de entrega sobre si el pedido ya se había despachado.
// Este flujo necesita las tres estaciones encendidas: se fijan acá (y se deja
// la configuración como estaba) para no depender de cómo la dejó otra prueba
// o de lo que se haya apagado a mano en el entorno local.
const MODULOS = ["cocinaHabilitada", "parrillaHabilitada", "entregaHabilitada"] as const;
let modulosOriginales: Record<string, boolean> = {};

test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
  const token = await apiLogin(request, "admin", "admin123");
  const auth = { Authorization: `Bearer ${token}` };
  const config = await (await request.get(`${API_URL}/configuracion`, { headers: auth })).json();
  modulosOriginales = Object.fromEntries(MODULOS.map((m) => [m, config[m]]));
  await request.patch(`${API_URL}/configuracion`, { headers: auth, data: Object.fromEntries(MODULOS.map((m) => [m, true])) });
});

test.afterAll(async ({ request }: { request: APIRequestContext }) => {
  const token = await apiLogin(request, "admin", "admin123");
  await request.patch(`${API_URL}/configuracion`, { headers: { Authorization: `Bearer ${token}` }, data: modulosOriginales });
});

test("un pedido pasa por caja, cocina, parrilla y entrega de punta a punta", async ({ page, request }) => {
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
  const numeroTicket = (await tituloTicket.textContent())!.replace("Ticket #", "").trim();
  // El número de ticket reinicia en cada turno: para llamar a la API hace
  // falta el folio único, que es el del último pedido pendiente.
  const pendientes = await (
    await request.get(`${API_URL}/pedidos?estado=pendientes`, { headers: { Authorization: `Bearer ${tokenAdmin}` } })
  ).json();
  const folio = String(Math.max(...pendientes.map((p: { folio: number }) => p.folio)));

  const tokenCocina = await apiLogin(request, "cocina", "cocina123");
  await request.patch(`${API_URL}/pedidos/${folio}/cocina-lista`, { headers: { Authorization: `Bearer ${tokenCocina}` } });

  const tokenParrilla = await apiLogin(request, "parrilla", "parrilla123");
  await request.patch(`${API_URL}/pedidos/${folio}/parrilla-lista`, { headers: { Authorization: `Bearer ${tokenParrilla}` } });

  // Cerrar la sesión de cajero antes de entrar como entrega — si no,
  // navegar a /login con una sesión válida ya cargada redirige de una a la
  // estación del rol logueado (ver LoginPage) y nunca muestra el formulario.
  await page.evaluate(() => localStorage.clear());
  await loginUI(page, "entrega", "entrega123");
  await page.waitForURL(/\/entrega/);
  await page.waitForTimeout(500);

  const tarjeta = page.locator("article", { hasText: `#${numeroTicket}` });
  await expect(tarjeta).toBeVisible();
  // El botón tiene que invitar a la acción ("Entregar"), no anunciar un
  // resultado que todavía no pasó ("Entregado").
  const boton = tarjeta.getByRole("button", { name: "Entregar" });
  await expect(boton).toBeVisible();
  await expect(boton).toBeEnabled();
  await boton.click();
  await page.getByRole("button", { name: /sí, ya se entregó/i }).click();
  await expect(tarjeta).not.toBeVisible({ timeout: 5000 });

  const pedido = await (
    await request.get(`${API_URL}/pedidos/cola?estacion=entrega`, { headers: { Authorization: `Bearer ${tokenAdmin}` } })
  ).json();
  expect(pedido.some((p: { folio: number }) => String(p.folio) === folio)).toBe(false);

  await asegurarSinTurnoAbierto(request, tokenAdmin);
});
