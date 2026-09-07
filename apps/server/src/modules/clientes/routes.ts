import type { FastifyInstance } from "fastify";
import { crearClienteSchema } from "shared";
import { crearCliente, listarClientes, ClienteValidationError } from "./service.js";

export async function clientesRoutes(fastify: FastifyInstance) {
  fastify.get("/clientes", { preHandler: [fastify.requireRole("cajero", "admin")] }, async (request) => {
    const { q } = request.query as { q?: string };
    return listarClientes(q);
  });

  fastify.post("/clientes", { preHandler: [fastify.requireRole("cajero", "admin")] }, async (request, reply) => {
    const parsed = crearClienteSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const cliente = await crearCliente(parsed.data);
      return reply.code(201).send(cliente);
    } catch (error) {
      if (error instanceof ClienteValidationError) {
        return reply.code(409).send({ error: error.message });
      }
      throw error;
    }
  });
}
