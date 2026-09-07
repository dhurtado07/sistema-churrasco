import type { FastifyInstance } from "fastify";
import { crearProveedorSchema, actualizarProveedorSchema } from "shared";
import { actualizarProveedor, crearProveedor, listarProveedores } from "./service.js";

export async function proveedoresRoutes(fastify: FastifyInstance) {
  fastify.get("/proveedores", { preHandler: [fastify.requireRole("cajero", "admin")] }, async (request) => {
    const { activos } = request.query as { activos?: string };
    return listarProveedores(activos === "true");
  });

  fastify.post("/proveedores", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const parsed = crearProveedorSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const proveedor = await crearProveedor(parsed.data);
    return reply.code(201).send(proveedor);
  });

  fastify.patch("/proveedores/:id", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = actualizarProveedorSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return actualizarProveedor(id, parsed.data);
  });
}
