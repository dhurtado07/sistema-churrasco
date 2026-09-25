import type { FastifyInstance, FastifyReply } from "fastify";
import { prisma } from "../../db.js";
import { decodificarDataUri } from "./urls.js";

async function enviarImagen(reply: FastifyReply, imagenUrl: string | null | undefined) {
  const imagen = imagenUrl ? decodificarDataUri(imagenUrl) : null;
  if (!imagen) return reply.code(404).send({ error: "Imagen no encontrada" });
  return (
    reply
      .header("Content-Type", imagen.contentType)
      // La URL lleva ?v=<hash de la foto>: si la foto cambia, cambia la URL.
      .header("Cache-Control", "public, max-age=31536000, immutable")
      // La web vive en otro origen que la API; helmet por defecto solo deja
      // cargar recursos desde el mismo origen y el <img> quedaría bloqueado.
      .header("Cross-Origin-Resource-Policy", "cross-origin")
      .send(imagen.contenido)
  );
}

/** Públicas, sin login: son las mismas fotos que ya muestra el menú público,
 * y un <img> no puede mandar el token de la app. */
export async function imagenesRoutes(fastify: FastifyInstance) {
  fastify.get("/imagenes/productos/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const producto = await prisma.producto.findUnique({ where: { id }, select: { imagenUrl: true } });
    return enviarImagen(reply, producto?.imagenUrl);
  });

  fastify.get("/imagenes/extras/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const extra = await prisma.extra.findUnique({ where: { id }, select: { imagenUrl: true } });
    return enviarImagen(reply, extra?.imagenUrl);
  });
}
