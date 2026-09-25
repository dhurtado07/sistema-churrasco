export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

/** Las fotos de productos/extras llegan como ruta de la API (/imagenes/...),
 * no como data URI, para que los pedidos y el menú pesen poco y el navegador
 * cachee cada foto. Una URL completa o un data URI se dejan tal cual. */
export function urlDeImagen(url: string): string {
  return url.startsWith("/") ? `${API_URL}${url}` : url;
}
