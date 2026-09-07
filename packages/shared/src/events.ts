import type { Pedido, Producto, Extra, ReporteGanancias, Configuracion, MovimientoCaja } from "./types.js";

export const SOCKET_EVENTS = {
  PEDIDO_NUEVO: "pedido:nuevo",
  PEDIDO_ACTUALIZADO: "pedido:actualizado",
  PEDIDO_CANCELADO: "pedido:cancelado",
  PEDIDO_COCINA_LISTA: "pedido:cocina_lista",
  PEDIDO_PARRILLA_LISTA: "pedido:parrilla_lista",
  PEDIDO_COMPLETADO: "pedido:completado",
  PEDIDO_ENTREGADO: "pedido:entregado",
  MENU_ACTUALIZADO: "menu:actualizado",
  VENTA_REGISTRADA: "venta:registrada",
  TICKET_IMPRIMIR: "ticket:imprimir",
  CONFIGURACION_ACTUALIZADA: "configuracion:actualizada",
  CAJA_MOVIMIENTO_REGISTRADO: "caja:movimiento_registrado",
} as const;

export interface ServerToClientEvents {
  [SOCKET_EVENTS.PEDIDO_NUEVO]: (pedido: Pedido) => void;
  [SOCKET_EVENTS.PEDIDO_ACTUALIZADO]: (pedido: Pedido) => void;
  [SOCKET_EVENTS.PEDIDO_CANCELADO]: (pedido: Pedido) => void;
  [SOCKET_EVENTS.PEDIDO_COCINA_LISTA]: (pedido: Pedido) => void;
  [SOCKET_EVENTS.PEDIDO_PARRILLA_LISTA]: (pedido: Pedido) => void;
  [SOCKET_EVENTS.PEDIDO_COMPLETADO]: (pedido: Pedido) => void;
  [SOCKET_EVENTS.PEDIDO_ENTREGADO]: (pedido: Pedido) => void;
  [SOCKET_EVENTS.MENU_ACTUALIZADO]: (payload: { productos: Producto[]; extras: Extra[] }) => void;
  [SOCKET_EVENTS.VENTA_REGISTRADA]: (reporte: ReporteGanancias) => void;
  [SOCKET_EVENTS.TICKET_IMPRIMIR]: (pedido: Pedido) => void;
  [SOCKET_EVENTS.CONFIGURACION_ACTUALIZADA]: (configuracion: Configuracion) => void;
  [SOCKET_EVENTS.CAJA_MOVIMIENTO_REGISTRADO]: (movimiento: MovimientoCaja) => void;
}

export type EstacionRoom = "cajero" | "cocina" | "parrilla" | "entrega" | "admin" | "impresora" | "empleado";
