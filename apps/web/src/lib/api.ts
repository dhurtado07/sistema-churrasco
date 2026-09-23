import { API_URL } from "./env";

export class ApiError extends Error {}

/** El servidor dijo que el token venció o es inválido — no es un rechazo del
 * pedido/acción en sí: hay que volver a iniciar sesión y reintentar. */
export class SesionVencidaError extends ApiError {}

let alExpirarSesion: (() => void) | null = null;

/** AuthProvider registra acá qué hacer cuando el servidor dice que el token
 * ya no vale (venció o es inválido): cerrar sesión y mandar a /login, en vez
 * de dejar la pantalla mostrando datos viejos que ya no se pueden refrescar. */
export function registrarAlExpirarSesion(handler: (() => void) | null) {
  alExpirarSesion = handler;
}

async function errorDeRespuesta(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && body.code === "SESION_EXPIRADA") {
    alExpirarSesion?.();
    return new SesionVencidaError("Tu sesión venció. Iniciá sesión de nuevo.");
  }
  return new ApiError(typeof body.error === "string" ? body.error : `Error ${res.status}`);
}

export async function apiFetch<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) throw await errorDeRespuesta(res);

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Descarga un archivo generado por la API (ej. un reporte en Excel) usando
 * el token de autenticación, ya que un link normal no puede mandar headers. */
export async function descargarArchivo(path: string, token: string | null, nombreArchivo: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw await errorDeRespuesta(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
