import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { crearPedidoSchema } from "shared";
import {
  cancelarPedido,
  crearPedido,
  editarPedido,
  listarAuditoriaPedido,
  listarCola,
  listarPedidos,
  marcarCocinaLista,
  marcarEntregado,
  marcarParrillaLista,
  obtenerPedido,
  PedidoValidationError,
  type FiltroPedidos,
} from "./service.js";
import { realtime } from "../../ws/socket.js";
import { reporteGananciasDeHoy } from "../reportes/service.js";
import { anularVentaPedido, registrarVentaPedido, reemplazarVentaPedido } from "../caja/service.js";

function manejarErrorPedido(error: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } } ) {
  if (error instanceof PedidoValidationError) {
    return reply.code(409).send({ error: error.message });
  }
  // El usuario, cliente o producto que referencia el pedido ya no existe
  // (p. ej. una sesión vieja de un usuario que fue borrado, o un producto
  // desactivado/eliminado después de que se cargó el menú en el navegador).
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    return reply.code(409).send({
      error: "Tu sesión ya no es válida o el menú cambió. Cerrá sesión, volvé a entrar y recargá el menú.",
    });
  }
  // El pedido no existe (id inválido, o ya se borró) — Prisma tira esto al
  // intentar actualizar un registro inexistente.
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return reply.code(404).send({ error: "Pedido no encontrado." });
  }
  // Timeout transitorio de la base bajo escritura concurrente (varias
  // estaciones cobrando/marcando "listo" a la vez) — ya se reintentó puertas
  // adentro; si llegó hasta acá es porque siguió ocupada. No es un error del
  // pedido: pedirle al usuario que reintente evita un 500 genérico.
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P1008" || error.code === "P2028")) {
    return reply.code(503).send({
      error: "El sistema está muy ocupado en este momento. Esperá un segundo y volvé a intentar.",
    });
  }
  throw error;
}

export async function pedidosRoutes(fastify: FastifyInstance) {
  fastify.post("/pedidos", { preHandler: [fastify.requireRole("cajero", "admin")] }, async (request, reply) => {
    const parsed = crearPedidoSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const pedido = await crearPedido(parsed.data, { id: request.user.sub });
      const movimiento = await registrarVentaPedido(pedido, request.user.sub);
      realtime.cajaMovimientoRegistrado(movimiento);
      if (pedido.estado === "PAGADO") {
        realtime.pedidoNuevo(pedido);
      } else {
        // Nació ya resuelto porque algún módulo (cocina/parrilla/entrega)
        // está deshabilitado en la configuración — no hay nada pendiente
        // que mostrarle a cocina/parrilla.
        realtime.pedidoCompletado(pedido);
        if (pedido.estado === "ENTREGADO") {
          realtime.pedidoEntregado(pedido);
        }
        realtime.ventaRegistrada(await reporteGananciasDeHoy());
      }
      // Ticket digital ya se muestra en caja; esto además dispara la impresión
      // térmica automática vía el agente de impresión local (si hay uno conectado).
      realtime.ticketImprimir(pedido);
      return reply.code(201).send(pedido);
    } catch (error) {
      return manejarErrorPedido(error, reply);
    }
  });

  // Lectura del historial de pedidos: además de caja/admin, cocina, parrilla
  // y entrega también pueden consultarlo (de solo lectura, ver "Ver pedidos"
  // en cada estación) — sobre todo para revisar qué se entregó. Ninguna de
  // esas rutas de escritura (editar/cancelar más abajo) las incluye.
  fastify.get(
    "/pedidos",
    { preHandler: [fastify.requireRole("cajero", "cocina", "parrilla", "entrega", "admin")] },
    async (request) => {
      const { estado } = request.query as { estado?: string };
      const filtros: FiltroPedidos[] = ["pendientes", "listos", "atendidos", "cancelados", "todos"];
      const filtro = (filtros as string[]).includes(estado ?? "") ? (estado as FiltroPedidos) : "pendientes";
      return listarPedidos(filtro);
    },
  );

  fastify.patch("/pedidos/:id", { preHandler: [fastify.requireRole("cajero", "admin")] }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (Number.isNaN(id)) return reply.code(400).send({ error: "id inválido" });

    const parsed = crearPedidoSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const pedido = await editarPedido(id, parsed.data, request.user.sub);
      const movimiento = await reemplazarVentaPedido(pedido, request.user.sub);
      realtime.cajaMovimientoRegistrado(movimiento);
      realtime.pedidoActualizado(pedido);
      // El pedido editado podría haber quedado listo/entregado de una vez si
      // algún módulo está deshabilitado (ver Configuración).
      if (pedido.estado !== "PAGADO") {
        realtime.pedidoCompletado(pedido);
        if (pedido.estado === "ENTREGADO") {
          realtime.pedidoEntregado(pedido);
        }
        realtime.ventaRegistrada(await reporteGananciasDeHoy());
      }
      return pedido;
    } catch (error) {
      return manejarErrorPedido(error, reply);
    }
  });

  fastify.patch(
    "/pedidos/:id/cancelar",
    { preHandler: [fastify.requireRole("cajero", "admin")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      if (Number.isNaN(id)) return reply.code(400).send({ error: "id inválido" });

      try {
        const pedido = await cancelarPedido(id, request.user.sub);
        const reverso = await anularVentaPedido(pedido.folio, request.user.sub);
        if (reverso) realtime.cajaMovimientoRegistrado(reverso);
        realtime.pedidoCancelado(pedido);
        return pedido;
      } catch (error) {
        return manejarErrorPedido(error, reply);
      }
    },
  );

  fastify.post(
    "/pedidos/:id/reimprimir",
    { preHandler: [fastify.requireRole("cajero", "admin")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      if (Number.isNaN(id)) return reply.code(400).send({ error: "id inválido" });

      const pedido = await obtenerPedido(id);
      if (!pedido) return reply.code(404).send({ error: "Pedido no encontrado" });

      realtime.ticketImprimir(pedido);
      return { ok: true };
    },
  );

  fastify.get(
    "/pedidos/cola",
    { preHandler: [fastify.requireRole("cocina", "parrilla", "entrega", "admin")] },
    async (request, reply) => {
      const { estacion } = request.query as { estacion?: string };
      if (estacion !== "cocina" && estacion !== "parrilla" && estacion !== "entrega") {
        return reply.code(400).send({ error: "estacion debe ser 'cocina', 'parrilla' o 'entrega'" });
      }
      return listarCola(estacion);
    },
  );

  fastify.patch(
    "/pedidos/:id/cocina-lista",
    { preHandler: [fastify.requireRole("cocina", "admin")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      if (Number.isNaN(id)) return reply.code(400).send({ error: "id inválido" });

      try {
        const { pedido, completado, entregadoAuto } = await marcarCocinaLista(id);
        realtime.pedidoCocinaLista(pedido);
        if (completado) {
          realtime.pedidoCompletado(pedido);
          // Si "entrega" está deshabilitada, cocina es la última rama de la
          // cadena y su "Listo" cierra el pedido de una vez.
          if (entregadoAuto) realtime.pedidoEntregado(pedido);
          realtime.ventaRegistrada(await reporteGananciasDeHoy());
        }
        return pedido;
      } catch (error) {
        return manejarErrorPedido(error, reply);
      }
    },
  );

  fastify.patch(
    "/pedidos/:id/parrilla-lista",
    { preHandler: [fastify.requireRole("parrilla", "admin")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      if (Number.isNaN(id)) return reply.code(400).send({ error: "id inválido" });

      try {
        const { pedido, completado, entregadoAuto } = await marcarParrillaLista(id);
        realtime.pedidoParrillaLista(pedido);
        if (completado) {
          realtime.pedidoCompletado(pedido);
          // Si "entrega" está deshabilitada, parrilla es la última rama de la
          // cadena y su "Listo" cierra el pedido de una vez.
          if (entregadoAuto) realtime.pedidoEntregado(pedido);
          realtime.ventaRegistrada(await reporteGananciasDeHoy());
        }
        return pedido;
      } catch (error) {
        return manejarErrorPedido(error, reply);
      }
    },
  );

  fastify.patch(
    "/pedidos/:id/entregar",
    { preHandler: [fastify.requireRole("entrega", "admin")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      if (Number.isNaN(id)) return reply.code(400).send({ error: "id inválido" });

      try {
        const pedido = await marcarEntregado(id);
        realtime.pedidoEntregado(pedido);
        return pedido;
      } catch (error) {
        return manejarErrorPedido(error, reply);
      }
    },
  );

  fastify.get(
    "/pedidos/:id/auditoria",
    { preHandler: [fastify.requireRole("admin")] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      if (Number.isNaN(id)) return reply.code(400).send({ error: "id inválido" });
      return listarAuditoriaPedido(id);
    },
  );
}
