import { useEffect, type ComponentType, type SVGProps } from "react";
import type { Pedido } from "shared";
import { useConfiguracion } from "../lib/configuracionContext";
import { formatBs, formatoFechaHoraBO } from "../lib/format";
import { formatoExtra } from "../lib/pedidosDisplay";
import { IconClose, IconPrint } from "./icons";

/**
 * Ticket en pantalla, con opción de imprimirlo por el navegador. Se usa tanto
 * al cobrar en Caja como desde el historial de Pedidos en Admin — si se
 * actualiza la página antes de imprimir, esta es la forma de recuperar el
 * ticket sin que el cliente se quede sin comprobante.
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

  // Mientras el ticket está abierto, la hoja de impresión pasa a ser el rollo
  // térmico de 58mm de ancho y alto automático (lo justo que ocupa el ticket).
  // Se sobrescribe la @page POR DEFECTO —en vez de usar una @page con nombre
  // solo para el ticket— porque al mezclar dos tamaños de página el navegador
  // metía una hoja en blanco antes del ticket. Los reportes de Admin se
  // imprimen con el ticket cerrado, así que siguen saliendo en A4.
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = "@page { size: 58mm auto; margin: 3mm; }";
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="ticket-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="ticket-imprimible w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-lg sm:rounded-2xl">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {configuracion.nombreNegocio}
        </p>
        <h2 className="mb-1 text-lg font-bold">{pendienteSync ? "Ticket — pendiente de sincronizar" : `Ticket #${pedido.folio}`}</h2>
        {pendienteSync && (
          <p className="mb-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800 no-imprimir">
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

        <div className="no-imprimir flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-200 px-3 py-3 text-sm font-medium"
          >
            <IconPrint width={16} height={16} />
            Imprimir
          </button>
          <button
            onClick={onCerrar}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-3 text-sm font-medium text-white"
          >
            <IconoBotonCerrar width={16} height={16} />
            {textoBotonCerrar}
          </button>
        </div>
      </div>
    </div>
  );
}
