import type { FastifyInstance } from "fastify";
import { ajustarStockInsumoSchema, crearInsumoSchema, actualizarInsumoSchema } from "shared";
import { actualizarInsumo, ajustarStockInsumo, crearInsumo, InsumoValidationError, listarInsumos } from "./service.js";

function manejarError(error: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) {
  if (error instanceof InsumoValidationError) return reply.code(409).send({ error: error.message });
  throw error;
}

export async function insumosRoutes(fastify: FastifyInstance) {
  fastify.get("/insumos", { preHandler: [fastify.requireRole("admin")] }, async (request) => {
    const { activos } = request.query as { activos?: string };
    return listarInsumos(activos === "true");
  });

  fastify.post("/insumos", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const parsed = crearInsumoSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const insumo = await crearInsumo(parsed.data);
      return reply.code(201).send(insumo);
    } catch (error) {
      return manejarError(error, reply);
    }
  });

  fastify.patch("/insumos/:id", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = actualizarInsumoSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      return await actualizarInsumo(id, parsed.data);
    } catch (error) {
      return manejarError(error, reply);
    }
  });

  fastify.post("/insumos/:id/ajustar-stock", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = ajustarStockInsumoSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      // La nota queda solo para que quien ajusta explique por qué (merma,
      // conteo físico, etc.) — no se persiste todavía en un historial (ver
      // nota en el servicio); igual la exigimos en el schema para que quede
      // el hábito de justificar el ajuste.
      return await ajustarStockInsumo(id, parsed.data.delta);
    } catch (error) {
      return manejarError(error, reply);
    }
  });
}
