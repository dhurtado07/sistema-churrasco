import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "node:http";
import jwt from "jsonwebtoken";
import {
  SOCKET_EVENTS,
  type Pedido,
  type Producto,
  type Extra,
  type ReporteGanancias,
  type Configuracion,
  type MovimientoCaja,
} from "shared";
import { env } from "../env.js";
import type { JwtPayload } from "../auth/plugin.js";

export type EstacionRoom = "cajero" | "cocina" | "parrilla" | "entrega" | "admin" | "impresora" | "empleado";

let io: SocketIOServer | null = null;

export function createSocketServer(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
    // El evento menu:actualizado puede llevar imágenes de producto como data
    // URI — el default de Socket.IO (1MB) se queda corto para eso.
    maxHttpBufferSize: 6 * 1024 * 1024,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("No autenticado"));
    try {
      const payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error("Token inválido"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as JwtPayload;
    socket.join(user.rol satisfies EstacionRoom);
    // El admin necesita ver todo lo que ven caja/cocina/parrilla para el dashboard en vivo.
    if (user.rol === "admin") {
      socket.join("cajero");
      socket.join("cocina");
      socket.join("parrilla");
      socket.join("entrega");
    }
  });

  return io;
}

function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.IO no ha sido inicializado");
  return io;
}

export const realtime = {
  pedidoNuevo(pedido: Pedido) {
    // "entrega" ve todos los pedidos desde que se pagan (para saber qué viene),
    // aunque todavía los estén preparando cocina/parrilla.
    const rooms: EstacionRoom[] = pedido.requiereParrilla
      ? ["cocina", "parrilla", "entrega"]
      : ["cocina", "entrega"];
    getIO().to(rooms).emit(SOCKET_EVENTS.PEDIDO_NUEVO, pedido);
  },
  pedidoActualizado(pedido: Pedido) {
    getIO().to(["cocina", "parrilla", "cajero", "entrega"]).emit(SOCKET_EVENTS.PEDIDO_ACTUALIZADO, pedido);
  },
  pedidoCancelado(pedido: Pedido) {
    getIO().to(["cocina", "parrilla", "cajero", "entrega"]).emit(SOCKET_EVENTS.PEDIDO_CANCELADO, pedido);
  },
  pedidoCocinaLista(pedido: Pedido) {
    // También a "cocina": si hay más de una terminal de cocina, las demás
    // necesitan enterarse de que otra ya lo marcó listo.
    getIO().to(["cocina", "parrilla", "cajero", "admin", "entrega"]).emit(SOCKET_EVENTS.PEDIDO_COCINA_LISTA, pedido);
  },
  pedidoParrillaLista(pedido: Pedido) {
    getIO().to(["cocina", "parrilla", "cajero", "admin", "entrega"]).emit(SOCKET_EVENTS.PEDIDO_PARRILLA_LISTA, pedido);
  },
  pedidoCompletado(pedido: Pedido) {
    // "entrega" necesita enterarse apenas el pedido queda listo (cocina Y
    // parrilla terminaron) para que aparezca como "listo para entregar".
    getIO().to(["cocina", "parrilla", "cajero", "entrega"]).emit(SOCKET_EVENTS.PEDIDO_COMPLETADO, pedido);
  },
  pedidoEntregado(pedido: Pedido) {
    getIO().to(["cajero", "entrega"]).emit(SOCKET_EVENTS.PEDIDO_ENTREGADO, pedido);
  },
  menuActualizado(payload: { productos: Producto[]; extras: Extra[] }) {
    getIO().to("cajero").emit(SOCKET_EVENTS.MENU_ACTUALIZADO, payload);
  },
  ventaRegistrada(reporte: ReporteGanancias) {
    getIO().to("admin").emit(SOCKET_EVENTS.VENTA_REGISTRADA, reporte);
  },
  ticketImprimir(pedido: Pedido) {
    getIO().to("impresora").emit(SOCKET_EVENTS.TICKET_IMPRIMIR, pedido);
  },
  configuracionActualizada(configuracion: Configuracion) {
    // Todas las estaciones necesitan saber al instante si su módulo se
    // habilitó o deshabilitó, así que se manda a todos los conectados.
    getIO().emit(SOCKET_EVENTS.CONFIGURACION_ACTUALIZADA, configuracion);
  },
  cajaMovimientoRegistrado(movimiento: MovimientoCaja) {
    getIO().to("admin").emit(SOCKET_EVENTS.CAJA_MOVIMIENTO_REGISTRADO, movimiento);
  },
};
