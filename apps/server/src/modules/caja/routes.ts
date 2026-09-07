import type { FastifyInstance } from "fastify";
import { abrirTurnoSchema, cerrarTurnoSchema, crearMovimientoCajaSchema } from "shared";
import {
  abrirTurno,
  anularMovimiento,
  CajaValidationError,
  cerrarTurno,
  listarMovimientos,
  obtenerTurnoActivo,
  registrarMovimientoManual,
} from "./service.js";
import { realtime } from "../../ws/socket.js";

function manejarErrorCaja(error: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) {
  if (error instanceof CajaValidationError) return reply.code(409).send({ error: error.message });
  throw error;
}

export async function cajaRoutes(fastify: FastifyInstance) {
  fastify.get("/caja/turnos/activo", { preHandler: [fastify.requireRole("cajero", "admin")] }, async () => {
    return obtenerTurnoActivo();
  });

  fastify.post("/caja/turnos", { preHandler: [fastify.requireRole("cajero", "admin")] }, async (request, reply) => {
    const parsed = abrirTurnoSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const turno = await abrirTurno(request.user.sub, parsed.data.fondoInicial);
      return reply.code(201).send(turno);
    } catch (error) {
      return manejarErrorCaja(error, reply);
    }
  });

  fastify.patch(
    "/caja/turnos/:id/cerrar",
    { preHandler: [fastify.requireRole("cajero", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = cerrarTurnoSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      try {
        const turno = await cerrarTurno(id, request.user.sub, parsed.data.efectivoContado, parsed.data.notaCierre);
        return turno;
      } catch (error) {
        return manejarErrorCaja(error, reply);
      }
    },
  );

  fastify.get("/caja/movimientos", { preHandler: [fastify.requireRole("cajero", "admin")] }, async (request) => {
    const { turnoId, desde, hasta } = request.query as { turnoId?: string; desde?: string; hasta?: string };
    return listarMovimientos({
      turnoId,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
    });
  });

  fastify.post(
    "/caja/movimientos",
    { preHandler: [fastify.requireRole("cajero", "admin")] },
    async (request, reply) => {
      const parsed = crearMovimientoCajaSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const movimiento = await registrarMovimientoManual(parsed.data, request.user.sub);
      realtime.cajaMovimientoRegistrado(movimiento);
      return reply.code(201).send(movimiento);
    },
  );

  fastify.post(
    "/caja/movimientos/:id/anular",
    { preHandler: [fastify.requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const reverso = await anularMovimiento(id, request.user.sub);
        realtime.cajaMovimientoRegistrado(reverso);
        return reverso;
      } catch (error) {
        return manejarErrorCaja(error, reply);
      }
    },
  );
}
