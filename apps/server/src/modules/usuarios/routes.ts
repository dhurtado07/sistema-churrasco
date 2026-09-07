import type { FastifyInstance } from "fastify";
import { crearUsuarioEstacionSchema, actualizarUsuarioEstacionSchema } from "shared";
import { actualizarUsuarioEstacion, crearUsuarioEstacion, listarUsuariosEstacion, UsuarioValidationError } from "./service.js";

function manejarError(error: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) {
  if (error instanceof UsuarioValidationError) return reply.code(409).send({ error: error.message });
  throw error;
}

export async function usuariosRoutes(fastify: FastifyInstance) {
  fastify.get("/usuarios", { preHandler: [fastify.requireRole("admin")] }, async () => {
    return listarUsuariosEstacion();
  });

  fastify.post("/usuarios", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const parsed = crearUsuarioEstacionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const usuario = await crearUsuarioEstacion(parsed.data);
      return reply.code(201).send(usuario);
    } catch (error) {
      return manejarError(error, reply);
    }
  });

  fastify.patch("/usuarios/:id", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = actualizarUsuarioEstacionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      return await actualizarUsuarioEstacion(id, parsed.data);
    } catch (error) {
      return manejarError(error, reply);
    }
  });
}
