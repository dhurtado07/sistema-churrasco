import type { ComponentType, SVGProps } from "react";
import type { Pedido } from "shared";
import { useConfiguracion } from "../lib/configuracionContext";
import { formatBs, formatoFechaHoraBO } from "../lib/format";
import { formatoExtra } from "../lib/pedidosDisplay";
import { IconClose } from "./icons";

/**
 * Ticket en pantalla (solo visor). La impresión de verdad la hace el agente de
 * impresión (print-agent) automáticamente al cobrar, mandando ESC/POS a la
 * térmica — no se imprime desde el navegador (eso desperdiciaba papel). Si hace
 * falta reimprimir (impresora atascada, otra copia), se hace desde la lista de
 * Pedidos (Caja → "Pedidos pendientes" o Admin → Pedidos), por si este modal ya
 * se cerró.
 */
export function TicketModal({
  pedido,
  pendienteSync = false,
  textoBotonCerrar = "Cerrar",
  iconoBotonCerrar: IconoBotonCerrar = IconClose,
  onCerrar,
}: {
  pedido: Pedido;
  /** true solo para el ticket recién armado de una venta offline — todavía
   * no tiene folio real hasta que se sincronice. */
  pendienteSync?: boolean;
  textoBotonCerrar?: string;
  iconoBotonCerrar?: ComponentType<SVGProps<SVGSVGElement>>;
  onCerrar: () => void;
}) {
  const { configuracion } = useConfiguracion();

  return (
    <div className="ticket-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="ticket-imprimible w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-lg sm:rounded-2xl">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {configuracion.nombreNegocio}
        </p>
        <h2 className="mb-1 text-lg font-bold">{pendienteSync ? "Ticket — pendiente de sincronizar" : `Ticket #${pedido.folio}`}</h2>
        {pendienteSync && (
          <p className="mb-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
            Se cobró sin conexión — se manda solo al servidor apenas vuelva la señal, no hace falta hacer nada.
          </p>
        )}
        <p className="text-xs text-neutral-500">
          {pedido.tipoConsumo === "LOCAL"
            ? configuracion.mesaHabilitada
              ? `Mesa ${pedido.mesa ?? "?"}`
              : "En el local"
            : "Para llevar"}
          {pedido.clienteNombre ? ` · ${pedido.clienteNombre}` : ""}
        </p>
        <p className="mb-3 text-xs text-neutral-500">{formatoFechaHoraBO(pedido.creadoEn)}</p>

        <ul className="mb-3 space-y-2 text-sm">
          {pedido.items.map((item) => (
            <li key={item.id}>
              <div className="flex justify-between">
                <span>
                  {item.cantidad}x {item.nombreProducto}
                </span>
                <span>Bs {formatBs(item.precioUnitario * item.cantidad)}</span>
              </div>
              {item.extras.map((extra) => (
                <div key={extra.extraId} className="flex justify-between pl-4 text-xs text-neutral-500">
                  <span>+ {formatoExtra(extra)}</span>
                  <span>Bs {formatBs(extra.precio * extra.cantidad)}</span>
                </div>
              ))}
            </li>
          ))}
        </ul>

        <div className="mb-4 flex justify-between border-t border-neutral-200 pt-2 text-base font-bold">
          <span>Total</span>
          <span>Bs {formatBs(pedido.total)}</span>
        </div>

        <button
          onClick={onCerrar}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-3 text-sm font-medium text-white"
        >
          <IconoBotonCerrar width={16} height={16} />
          {textoBotonCerrar}
        </button>
      </div>
    </div>
  );
}
