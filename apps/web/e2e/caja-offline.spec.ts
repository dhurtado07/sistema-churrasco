import { test, expect } from "@playwright/test";
import { apiLogin, asegurarTurnoAbierto, asegurarSinTurnoAbierto, loginUI } from "./helpers";

// "Modo liviano" sin conexión: la app no se rompe, avisa, y se recupera sola
// apenas vuelve la señal — sin necesidad de recargar la página.
test("al perder la conexión aparece el aviso y se bloquea el cobro; al volver, se recupera solo", async ({
  page,
  context,
  request,
}) => {
  const tokenAdmin = await apiLogin(request, "admin", "admin123");
  await asegurarTurnoAbierto(request, tokenAdmin);

  await loginUI(page, "cajero", "cajero123");
  await page.waitForURL(/\/caja/);
  await page.waitForTimeout(500); // que el socket termine de conectar

  await page.click("text=Churrasco Sencillo");
  await page.click("text=Para llevar");
  const botonCobrar = page.getByRole("button", { name: /marcar como pagado/i });
  await expect(botonCobrar).toBeEnabled();
  await expect(page.getByText(/sin conexión/i)).not.toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText(/sin conexión/i)).toBeVisible({ timeout: 5000 });
  await expect(botonCobrar).toBeDisabled();

  await context.setOffline(false);
  await expect(page.getByText(/sin conexión/i)).not.toBeVisible({ timeout: 10000 });
  await expect(botonCobrar).toBeEnabled();

  await asegurarSinTurnoAbierto(request, tokenAdmin);
});
