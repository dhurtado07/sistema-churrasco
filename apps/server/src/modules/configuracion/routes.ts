import type { FastifyInstance } from "fastify";
import { actualizarConfiguracionSchema } from "shared";
import { actualizarConfiguracion, obtenerConfiguracion } from "./service.js";
import { realtime } from "../../ws/socket.js";

export async function configuracionRoutes(fastify: FastifyInstance) {
  // Cualquier estación autenticada necesita poder leer qué módulos están
  // habilitados (para saber si mostrarse a sí misma como disponible o no).
  fastify.get("/configuracion", { preHandler: [fastify.authenticate] }, async () => {
    return obtenerConfiguracion();
  });

  fastify.patch(
    "/configuracion",
    { preHandler: [fastify.requireRole("admin")] },
    async (request, reply) => {
      const parsed = actualizarConfiguracionSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const configuracion = await actualizarConfiguracion(parsed.data);
      realtime.configuracionActualizada(configuracion);
      return configuracion;
    },
  );
}
