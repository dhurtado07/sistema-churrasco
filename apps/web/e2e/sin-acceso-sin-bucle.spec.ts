import { test, expect } from "@playwright/test";
import { apiLogin } from "./helpers";

// Una cuenta "empleado" sin ficha de Empleado (ej. la ficha se borró, o la sesión es
// anterior a crearla) tiene /asistencia como pantalla propia pero no puede entrar.
// Antes /asistencia mandaba a /login y /login la devolvía a /asistencia: bucle
// infinito de redirecciones y pantalla en blanco.

test("un empleado sin ficha ve 'Sin acceso' en vez de quedar en un bucle de redirecciones", async ({ page, request }) => {
  const erroresDeBucle: string[] = [];
  page.on("console", (m) => {
    if (m.text().includes("Maximum update depth")) erroresDeBucle.push(m.text());
  });

  await page.goto("/login");
  // Token real (si no, la API responde 401 y la app cierra la sesión antes de
  // llegar al caso); el ruteo decide con el perfil guardado, que es el que se falsea.
  const token = await apiLogin(request, "cajero", "cajero123");
  await page.evaluate((t) => {
    localStorage.setItem(
      "churrasco.auth",
      JSON.stringify({
        token: t,
        usuario: { id: "x", username: "sin_ficha", rol: "empleado", nombre: "Sin Ficha", tieneEmpleado: false },
      }),
    );
  }, token);

  await page.goto("/asistencia");
  await expect(page.getByText("Tu cuenta no tiene acceso a esta pantalla.")).toBeVisible();
  await expect(page).toHaveURL(/\/asistencia/);
  expect(erroresDeBucle).toEqual([]);
});
