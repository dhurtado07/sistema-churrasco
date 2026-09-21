import { useState, type ComponentType, type SVGProps } from "react";
import type { Pedido } from "shared";
import { useAuth } from "../lib/auth";
import { useConfiguracion } from "../lib/configuracionContext";
import { apiFetch } from "../lib/api";
import { formatBs, formatoFechaHoraBO } from "../lib/format";
import { formatoExtra } from "../lib/pedidosDisplay";
import { IconClose, IconPrint, IconRefresh } from "./icons";

/**
 * Ticket en pantalla, con opción de imprimirlo (por el navegador) o
 * reimprimirlo (reenviarlo a la impresora térmica de la estación vía el
 * agente de impresión). Se usa tanto al cobrar en Caja como desde el
 * historial de Pedidos en Admin — si se actualiza la página antes de
 * imprimir, o si la impresora se atascó, esta es la forma de recuperar el
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
   * no tiene folio real ni se puede reimprimir hasta que se sincronice. */
  pendienteSync?: boolean;
  textoBotonCerrar?: string;
  iconoBotonCerrar?: ComponentType<SVGProps<SVGSVGElement>>;
  onCerrar: () => void;
}) {
  const { token } = useAuth();
  const { configuracion } = useConfiguracion();
  const [reimprimiendo, setReimprimiendo] = useState(false);
  const [reimprimirError, setReimprimirError] = useState<string | null>(null);

  async function reimprimir() {
    setReimprimiendo(true);
    setReimprimirError(null);
    try {
      await apiFetch(`/pedidos/${pedido.folio}/reimprimir`, token, { method: "POST" });
    } catch (err) {
      setReimprimirError(err instanceof Error ? err.message : "No se pudo reimprimir");
    } finally {
      setReimprimiendo(false);
    }
  }

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

        {reimprimirError && <p className="mb-2 text-xs text-red-600 no-imprimir">{reimprimirError}</p>}

        <div className="no-imprimir flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-200 px-3 py-3 text-sm font-medium"
          >
            <IconPrint width={16} height={16} />
            Imprimir
          </button>
          {!pendienteSync && (
            <button
              onClick={reimprimir}
              disabled={reimprimiendo}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-200 px-3 py-3 text-sm font-medium disabled:opacity-50"
              title="Reenvía el ticket a la impresora térmica de la estación"
            >
              <IconRefresh width={16} height={16} />
              {reimprimiendo ? "Enviando…" : "Reimprimir"}
            </button>
          )}
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
