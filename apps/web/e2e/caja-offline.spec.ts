import { test, expect } from "@playwright/test";
import { API_URL, apiLogin, asegurarTurnoAbierto, asegurarSinTurnoAbierto, loginUI } from "./helpers";

// Offline-first en Caja: si se corta la conexión, el negocio no puede parar
// de vender — el cobro se guarda en el propio navegador y se muestra como
// pagado de una (con un aviso de "pendiente de sincronizar" en vez de un
// folio real). Apenas vuelve la señal, esa venta se manda sola al servidor
// sin que nadie tenga que hacer nada.
test("cobrar sin conexión guarda la venta y se sincroniza sola al volver", async ({ page, context, request }) => {
  const tokenAdmin = await apiLogin(request, "admin", "admin123");
  const turno = await asegurarTurnoAbierto(request, tokenAdmin);

  await loginUI(page, "cajero", "cajero123");
  await page.waitForURL(/\/caja/);
  await page.waitForTimeout(500); // que el socket termine de conectar y el menú se cachee

  await page.click("text=Churrasco Sencillo");
  await page.click("text=Para llevar");
  const botonCobrar = page.getByRole("button", { name: /marcar como pagado/i });
  await expect(botonCobrar).toBeEnabled();
  await expect(page.getByText(/sin conexión/i)).not.toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText(/sin conexión/i)).toBeVisible({ timeout: 5000 });

  // El cobro sigue habilitado sin conexión — es justo el caso que tiene que
  // seguir funcionando.
  await expect(botonCobrar).toBeEnabled();
  await botonCobrar.click();
  await page.getByRole("button", { name: "Sí" }).click();

  await expect(page.getByText(/pendiente de sincronizar/i)).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Nuevo pedido" }).click();
  await expect(page.getByText(/1 venta por sincronizar/i)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/sin conexión/i)).not.toBeVisible({ timeout: 10_000 });
  // La cola se vacía sola en cuanto se sincroniza con el servidor.
  await expect(page.getByText(/venta.*por sincronizar/i)).not.toBeVisible({ timeout: 10_000 });

  // Confirma que la venta realmente llegó al servidor (no solo que la UI
  // dejó de mostrar el aviso) — tiene que aparecer en el libro de ese turno.
  const movimientos = await request
    .get(`${API_URL}/caja/movimientos?turnoId=${turno.id}`, { headers: { Authorization: `Bearer ${tokenAdmin}` } })
    .then((res) => res.json());
  expect(movimientos.some((m: { categoria: string; anulado: boolean }) => m.categoria === "VENTA" && !m.anulado)).toBe(
    true,
  );

  await asegurarSinTurnoAbierto(request, tokenAdmin);
});

// Caso de negocio explícito: si para cuando el equipo recupera la conexión
// alguien ya cerró el turno que estaba abierto cuando se hizo la venta
// offline (ej. otra caja cerró el día), la venta se registra igual — ya
// ocurrió de verdad — asociada a ESE turno aunque ya esté cerrado, no al que
// esté abierto en el momento de sincronizar (ni se descarta).
test("una venta offline se sincroniza igual aunque su turno ya se haya cerrado", async ({ page, context, request }) => {
  const tokenAdmin = await apiLogin(request, "admin", "admin123");
  const turno = await asegurarTurnoAbierto(request, tokenAdmin);

  await loginUI(page, "cajero", "cajero123");
  await page.waitForURL(/\/caja/);
  await page.waitForTimeout(500);

  await page.click("text=Churrasco Sencillo");
  await page.click("text=Para llevar");

  await context.setOffline(true);
  await expect(page.getByText(/sin conexión/i)).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: /marcar como pagado/i }).click();
  await page.getByRole("button", { name: "Sí" }).click();
  await expect(page.getByText(/pendiente de sincronizar/i)).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Nuevo pedido" }).click();

  // Se cierra el turno "por detrás" (otra caja, o el admin) mientras este
  // equipo seguía sin conexión y con la venta todavía sin mandar.
  await request.patch(`${API_URL}/caja/turnos/${turno.id}/cerrar`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
    data: { efectivoContado: 0 },
  });

  await context.setOffline(false);
  await expect(page.getByText(/venta.*por sincronizar/i)).not.toBeVisible({ timeout: 10_000 });

  const movimientos = await request
    .get(`${API_URL}/caja/movimientos?turnoId=${turno.id}`, { headers: { Authorization: `Bearer ${tokenAdmin}` } })
    .then((res) => res.json());
  expect(movimientos.some((m: { categoria: string; anulado: boolean }) => m.categoria === "VENTA" && !m.anulado)).toBe(
    true,
  );
});
