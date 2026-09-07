import type { FastifyInstance } from "fastify";
import { crearActivoInventarioSchema, actualizarActivoInventarioSchema } from "shared";
import { actualizarActivo, crearActivo, listarActivos } from "./service.js";

export async function inventarioRoutes(fastify: FastifyInstance) {
  fastify.get("/inventario", { preHandler: [fastify.requireRole("admin")] }, async (request) => {
    const { activos } = request.query as { activos?: string };
    return listarActivos(activos === "true");
  });

  fastify.post("/inventario", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const parsed = crearActivoInventarioSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const activo = await crearActivo(parsed.data);
    return reply.code(201).send(activo);
  });

  fastify.patch("/inventario/:id", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = actualizarActivoInventarioSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return actualizarActivo(id, parsed.data);
  });
}
