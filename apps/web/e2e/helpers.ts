import type { APIRequestContext, Page } from "@playwright/test";

// Los tests pegan directo a la API para preparar/limpiar estado (abrir o
// cerrar un turno, sacar un token) — es más rápido y más confiable que
// pasar por la UI para cosas que no son lo que ese test está probando.
export const API_URL = "http://localhost:3050";

export async function loginUI(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.fill("#login-username", username);
  await page.fill("#login-password", password);
  await page.click('button[type="submit"]');
}

export async function apiLogin(request: APIRequestContext, username: string, password: string): Promise<string> {
  const res = await request.post(`${API_URL}/auth/login`, { data: { username, password } });
  const body = await res.json();
  return body.token as string;
}

interface TurnoActivo {
  id: string;
}

async function turnoActivo(request: APIRequestContext, token: string): Promise<TurnoActivo | null> {
  const res = await request.get(`${API_URL}/caja/turnos/activo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

/** Deja el sistema SIN turno abierto — para probar de forma confiable el
 * bloqueo de "no se puede cobrar sin turno". */
export async function asegurarSinTurnoAbierto(request: APIRequestContext, token: string) {
  const turno = await turnoActivo(request, token);
  if (!turno) return;
  await request.patch(`${API_URL}/caja/turnos/${turno.id}/cerrar`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { efectivoContado: 0 },
  });
}

/** Abre un turno si no hay uno ya — para probar el flujo de venta, a la que
 * no le importa desde cuándo está abierto el turno. */
export async function asegurarTurnoAbierto(request: APIRequestContext, token: string): Promise<TurnoActivo> {
  const existente = await turnoActivo(request, token);
  if (existente) return existente;
  const res = await request.post(`${API_URL}/caja/turnos`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { fondoInicial: 100 },
  });
  return res.json();
}
