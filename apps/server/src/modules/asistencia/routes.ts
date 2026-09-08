import type { FastifyInstance } from "fastify";
import { marcarAsistenciaSchema } from "shared";
import {
  AsistenciaValidationError,
  generarExcelNomina,
  listarHorasTrabajadas,
  marcarPropia,
  obtenerMisHoras,
  obtenerProximaMarca,
} from "./service.js";

export async function asistenciaRoutes(fastify: FastifyInstance) {
  // Antes exigía rol==="empleado" exactamente — pero ahora un empleado puede
  // tener además un rol de estación (cajero/cocina/parrilla/entrega) y debe
  // poder marcar su asistencia igual. El gate real ya lo hace el servicio
  // (obtenerEmpleadoPorUsuario tira 409 si esta cuenta no tiene un Empleado
  // asociado, sin importar su rol) — acá alcanza con estar logueado.
  fastify.get("/asistencia/proxima-marca", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      return await obtenerProximaMarca(request.user.sub);
    } catch (error) {
      if (error instanceof AsistenciaValidationError) return reply.code(409).send({ error: error.message });
      throw error;
    }
  });

  fastify.post("/asistencia/marcar", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = marcarAsistenciaSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const marca = await marcarPropia(request.user.sub, parsed.data.notas, parsed.data.pin);
      return reply.code(201).send(marca);
    } catch (error) {
      if (error instanceof AsistenciaValidationError) return reply.code(409).send({ error: error.message });
      throw error;
    }
  });

  // Un empleado viendo sus propias horas/días trabajados — nunca los de otro
  // (el empleadoId sale de la sesión, no de un parámetro que mande el cliente).
  fastify.get("/asistencia/mis-horas", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { desde, hasta } = request.query as { desde?: string; hasta?: string };
    try {
      return await obtenerMisHoras(request.user.sub, {
        desde: desde ? new Date(desde) : undefined,
        hasta: hasta ? new Date(hasta) : undefined,
      });
    } catch (error) {
      if (error instanceof AsistenciaValidationError) return reply.code(409).send({ error: error.message });
      throw error;
    }
  });

  fastify.get("/asistencia", { preHandler: [fastify.requireRole("admin")] }, async (request) => {
    const { empleadoId, desde, hasta } = request.query as { empleadoId?: string; desde?: string; hasta?: string };
    return listarHorasTrabajadas({
      empleadoId,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
    });
  });

  fastify.get("/asistencia/excel", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const { desde, hasta } = request.query as { desde?: string; hasta?: string };
    const rangoDesde = desde ? new Date(desde) : undefined;
    const rangoHasta = hasta ? new Date(hasta) : undefined;
    if (!rangoDesde || !rangoHasta || Number.isNaN(rangoDesde.getTime()) || Number.isNaN(rangoHasta.getTime())) {
      return reply.code(400).send({ error: "desde y hasta son requeridos (ISO 8601)" });
    }
    const buffer = await generarExcelNomina(rangoDesde, rangoHasta);
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", "attachment; filename=nomina.xlsx");
    return reply.send(buffer);
  });
}
