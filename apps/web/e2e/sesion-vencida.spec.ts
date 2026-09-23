import { test, expect, type Page } from "@playwright/test";

// Un equipo que queda abierto de un día para otro tiene el token vencido
// (dura 12 h). Antes la app seguía mostrando datos viejos en caché hasta que
// alguien cerraba sesión a mano; ahora tiene que mandar solo al login.

function base64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

/** JWT falso: el frontend solo lee `exp`; la firma no importa acá. */
function tokenFalso(expSegundos: number): string {
  return `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url({ exp: expSegundos })}.firma-invalida`;
}

async function sembrarSesion(page: Page, token: string) {
  await page.goto("/login");
  await page.evaluate((t) => {
    localStorage.setItem(
      "churrasco.auth",
      JSON.stringify({
        token: t,
        usuario: { id: "x", username: "cajero", rol: "cajero", nombre: "Caja", tieneEmpleado: false },
      }),
    );
  }, token);
}

test("una sesión con el token vencido lleva al login al abrir la app", async ({ page }) => {
  await sembrarSesion(page, tokenFalso(Math.floor(Date.now() / 1000) - 3600));
  await page.goto("/caja");
  await expect(page).toHaveURL(/\/login/);
});

test("si el servidor rechaza el token (401), la app cierra la sesión y va al login", async ({ page }) => {
  // exp lejano: el reloj no lo delata, solo el 401 del servidor (firma inválida).
  await sembrarSesion(page, tokenFalso(Math.floor(Date.now() / 1000) + 3600));
  await page.goto("/caja");
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  expect(await page.evaluate(() => localStorage.getItem("churrasco.auth"))).toBeNull();
});
