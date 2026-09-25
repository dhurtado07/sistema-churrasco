import type { Configuracion, ExtraSeleccionado, ItemPedido, Pedido } from "shared";

/** "Chorizo" si es una sola unidad, "2x Chorizo" si son varias — para que
 * cocina/parrilla sepan cuántas porciones preparar de verdad, no solo que
 * el plato "lleva" ese extra. */
export function formatoExtra(extra: Pick<ExtraSeleccionado, "nombre" | "cantidad">): string {
  return extra.cantidad > 1 ? `${extra.cantidad}x ${extra.nombre}` : extra.nombre;
}

export interface LineaPedido {
  key: string;
  nombre: string;
  cantidad: number;
  imagenUrl: string | null;
}

/** Plato y extras como líneas iguales: cada extra va justo debajo del plato
 * con el que se pidió, con su foto y su cantidad — antes iba como texto chico
 * bajo el plato y en cocina se perdía de vista. La cantidad del extra es la
 * de su línea, no se multiplica por la del plato (así también se cobra). */
export function lineasDelPedido(items: ItemPedido[]): LineaPedido[] {
  return items.flatMap((item) => [
    { key: item.id, nombre: item.nombreProducto, cantidad: item.cantidad, imagenUrl: item.imagenUrl },
    ...item.extras.map((extra, i) => ({
      key: `${item.id}-extra-${extra.extraId}-${i}`,
      nombre: extra.nombre,
      cantidad: extra.cantidad,
      imagenUrl: extra.imagenUrl ?? null,
    })),
  ]);
}

export type FiltroPedidos = "pendientes" | "listos" | "atendidos" | "cancelados";

export const TABS_PEDIDOS: { key: FiltroPedidos; label: string }[] = [
  { key: "pendientes", label: "Pendientes" },
  { key: "listos", label: "Listos para entregar" },
  { key: "atendidos", label: "Entregados" },
  // "Anulados" (no "Cancelados"): son pedidos que SÍ se cobraron y después se
  // revirtieron (repone stock + anula el ingreso en caja) — llamarlos solo
  // "cancelados" se prestaba a confundirlos con un pedido que nunca se pagó.
  { key: "cancelados", label: "Anulados" },
];

export const ESTADO_BADGE: Record<Pedido["estado"], string> = {
  PAGADO: "bg-amber-100 text-amber-800",
  COMPLETADO: "bg-sky-100 text-sky-800",
  ENTREGADO: "bg-emerald-100 text-emerald-800",
  CANCELADO: "bg-red-100 text-red-700",
};

export const ESTADO_LABEL: Record<Pedido["estado"], string> = {
  PAGADO: "Pendiente",
  COMPLETADO: "Listo para entregar",
  ENTREGADO: "Entregado",
  CANCELADO: "Anulado",
};

/** Solo se puede editar/cancelar mientras nadie en cocina o parrilla empezó a
 * prepararlo — mismo criterio que aplica el servidor. La usan Admin (editar/
 * anular) y Caja (anular) para saber si mostrar esos botones. */
export function puedeModificarse(
  pedido: Pedido,
  config: Pick<Configuracion, "cocinaHabilitada" | "parrillaHabilitada">,
): boolean {
  if (pedido.estado !== "PAGADO") return false;
  // Un módulo deshabilitado nace con su flag en true sin que nadie haya empezado
  // nada — solo cuenta el avance de los módulos habilitados.
  if (config.cocinaHabilitada && pedido.cocinaLista) return false;
  if (config.parrillaHabilitada && pedido.requiereParrilla && pedido.parrillaLista) return false;
  return true;
}
