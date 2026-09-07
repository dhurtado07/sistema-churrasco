import type { FastifyInstance } from "fastify";
import { crearEmpleadoSchema, actualizarEmpleadoSchema } from "shared";
import { actualizarEmpleado, crearEmpleado, EmpleadoValidationError, listarEmpleados } from "./service.js";

function manejarError(error: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) {
  if (error instanceof EmpleadoValidationError) return reply.code(409).send({ error: error.message });
  throw error;
}

export async function empleadosRoutes(fastify: FastifyInstance) {
  fastify.get("/empleados", { preHandler: [fastify.requireRole("admin")] }, async (request) => {
    const { activos } = request.query as { activos?: string };
    return listarEmpleados(activos === "true");
  });

  fastify.post("/empleados", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const parsed = crearEmpleadoSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const empleado = await crearEmpleado(parsed.data);
      return reply.code(201).send(empleado);
    } catch (error) {
      return manejarError(error, reply);
    }
  });

  fastify.patch("/empleados/:id", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = actualizarEmpleadoSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      return await actualizarEmpleado(id, parsed.data);
    } catch (error) {
      return manejarError(error, reply);
    }
  });
}
