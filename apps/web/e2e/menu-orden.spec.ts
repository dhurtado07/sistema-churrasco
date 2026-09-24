import { test, expect } from "@playwright/test";
import { API_URL, apiLogin } from "./helpers";

// El cliente pidió ver primero lo que más se vende. El orden se define en la
// migración `orden_menu_productos` (columna Producto.orden), sin cambiar nombres.
const ORDEN_PEDIDO = [
  "Churrasco Sencillo",
  "Churrasco con Chorizo",
  "Pollo Ala",
  "Pollo Pierna",
  "Mixto",
  "Mixto Especial",
  "Vacío Bife",
  "Pollerita",
];

test("el menú muestra los platos que más se venden primero, en el orden del cliente", async ({ request }) => {
  const token = await apiLogin(request, "cajero", "cajero123");
  const menu = await (await request.get(`${API_URL}/menu`, { headers: { Authorization: `Bearer ${token}` } })).json();

  const platos: string[] = menu.productos.filter((p: { categoria: string }) => p.categoria === "Platos").map((p: { nombre: string }) => p.nombre);
  // Solo los que existan (si el cliente renombra o quita alguno, el resto debe seguir en orden).
  const presentes = ORDEN_PEDIDO.filter((nombre) => platos.includes(nombre));
  expect(presentes.length).toBeGreaterThan(0);
  expect(platos.filter((nombre) => presentes.includes(nombre))).toEqual(presentes);
  // Y van antes que cualquier plato sin orden asignado.
  expect(platos.slice(0, presentes.length)).toEqual(presentes);
});
