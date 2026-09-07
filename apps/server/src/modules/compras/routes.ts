import type { FastifyInstance } from "fastify";
import { crearCompraSchema } from "shared";
import { CompraValidationError, crearCompra, listarCompras } from "./service.js";
import { registrarEgresoCompra } from "../caja/service.js";
import { realtime } from "../../ws/socket.js";

export async function comprasRoutes(fastify: FastifyInstance) {
  fastify.get("/compras", { preHandler: [fastify.requireRole("admin")] }, async (request) => {
    const { proveedorId, desde, hasta } = request.query as { proveedorId?: string; desde?: string; hasta?: string };
    return listarCompras({
      proveedorId,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
    });
  });

  fastify.post("/compras", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const parsed = crearCompraSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const compra = await crearCompra(parsed.data, request.user.sub);
      const movimiento = await registrarEgresoCompra(compra.id, compra.total, compra.proveedorNombre, request.user.sub);
      realtime.cajaMovimientoRegistrado(movimiento);
      return reply.code(201).send(compra);
    } catch (error) {
      if (error instanceof CompraValidationError) return reply.code(409).send({ error: error.message });
      throw error;
    }
  });
}
