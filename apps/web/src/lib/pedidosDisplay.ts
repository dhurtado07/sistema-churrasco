import type { ExtraSeleccionado, Pedido } from "shared";

/** "Chorizo" si es una sola unidad, "2x Chorizo" si son varias — para que
 * cocina/parrilla sepan cuántas porciones preparar de verdad, no solo que
 * el plato "lleva" ese extra. */
export function formatoExtra(extra: Pick<ExtraSeleccionado, "nombre" | "cantidad">): string {
  return extra.cantidad > 1 ? `${extra.cantidad}x ${extra.nombre}` : extra.nombre;
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
export function puedeModificarse(pedido: Pedido): boolean {
  if (pedido.estado !== "PAGADO") return false;
  if (pedido.cocinaLista) return false;
  if (pedido.requiereParrilla && pedido.parrillaLista) return false;
  return true;
}
