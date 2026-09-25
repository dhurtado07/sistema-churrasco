import { createHash } from "node:crypto";

/**
 * Las fotos de productos y extras se guardan en la base como data URI (ver
 * resizeImageToDataUrl en la web): 20-80 KB de texto cada una. Mandarlas así
 * dentro de cada pedido y de /menu hacía que cada ítem de cada pedido pesara
 * ~100 KB y que cocina, parrilla, entrega y caja tardaran segundos en cargar.
 * En las respuestas de uso diario se reemplazan por un enlace corto a
 * /imagenes/..., que el navegador descarga una vez y guarda en caché.
 */
export type TipoImagen = "productos" | "extras";

/** El `v` cambia cuando cambia la foto, así la URL se puede cachear para
 * siempre sin mostrar nunca una foto vieja después de editarla. */
export function urlImagenPublica(tipo: TipoImagen, id: string, imagenUrl: string | null): string | null {
  if (!imagenUrl || !imagenUrl.startsWith("data:")) return imagenUrl;
  const version = createHash("sha1").update(imagenUrl).digest("hex").slice(0, 12);
  return `/imagenes/${tipo}/${id}?v=${version}`;
}

/** Producto/extra con la foto como enlace en vez del data URI completo. */
export function conImagenPublica<T extends { id: string; imagenUrl: string | null }>(tipo: TipoImagen, item: T): T {
  return { ...item, imagenUrl: urlImagenPublica(tipo, item.id, item.imagenUrl) };
}

export interface ImagenDecodificada {
  contentType: string;
  contenido: Buffer;
}

/** Solo imágenes en base64: es lo único que guarda la app, y cualquier otra
 * cosa (texto, HTML, SVG con scripts) no se sirve. */
export function decodificarDataUri(dataUri: string): ImagenDecodificada | null {
  const coincidencia = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUri);
  if (!coincidencia) return null;
  return { contentType: coincidencia[1], contenido: Buffer.from(coincidencia[2], "base64") };
}
