import { useRef, type ComponentType, type SVGProps } from "react";
import type { Pedido } from "shared";
import { useConfiguracion } from "../lib/configuracionContext";
import { formatBs, formatoFechaHoraBO } from "../lib/format";
import { formatoExtra } from "../lib/pedidosDisplay";
import { IconClose, IconPrint } from "./icons";

// Ancho del rollo de la impresora térmica (Epson TM-T20IV-L = 80mm). Si algún
// día se usa un rollo de 58mm, basta cambiar este número.
const ANCHO_ROLLO_MM = 80;
// Margen a cada lado. El área imprimible de la TM-T20 en 80mm es ~72mm, así que
// dejamos ~72mm de contenido para que no se corte por los bordes.
const MARGEN_MM = 4;
// 1 pulgada CSS = 96px = 25.4mm — para convertir la altura medida en px a mm.
const PX_A_MM = 25.4 / 96;

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
  const ticketRef = useRef<HTMLDivElement>(null);

  /**
   * Imprime el ticket ajustando la hoja al rollo térmico. Antes se dejaba que
   * el navegador usara su hoja por defecto (Carta/A4): el ticket salía arriba y
   * abajo quedaba un espacio en blanco enorme, desperdiciando una hoja entera
   * por ticket. Ahora armamos una @page de 80mm de ancho y del alto EXACTO del
   * contenido, para que el rollo avance solo lo que ocupa el ticket y corte ahí.
   *
   * El alto se mide al vuelo porque el CSS `@page { size }` no admite alto
   * "auto" junto a un ancho fijo (queda inválido y el navegador lo ignora). Se
   * mide sobre un clon con el mismo ancho que tendrá impreso, ya que el ticket
   * en pantalla es más ancho y el texto envolvería distinto.
   */
  function imprimir() {
    const nodo = ticketRef.current;
    if (!nodo) {
      window.print();
      return;
    }
    const anchoContenidoMm = ANCHO_ROLLO_MM - MARGEN_MM * 2;

    const clon = nodo.cloneNode(true) as HTMLElement;
    clon.querySelectorAll(".no-imprimir").forEach((el) => el.remove());
    clon.style.position = "absolute";
    clon.style.left = "-9999px";
    clon.style.top = "0";
    clon.style.width = `${anchoContenidoMm}mm`;
    clon.style.maxWidth = "none";
    clon.style.padding = "0";
    clon.style.boxShadow = "none";
    document.body.appendChild(clon);
    const altoPx = clon.offsetHeight;
    document.body.removeChild(clon);

    // +1mm de colchón para que un redondeo hacia abajo no empuje la última línea
    // a una segunda hoja.
    const altoContenidoMm = Math.ceil(altoPx * PX_A_MM) + MARGEN_MM * 2 + 1;
    // El alto NUNCA debe ser menor que el ancho: si la página queda más ancha
    // que alta (ticket cortito), Chrome/el driver de la Epson la toman como
    // horizontal (landscape) y sacan el ticket rotado. Forzamos alto > ancho
    // para que siempre imprima vertical, sin dejar de ajustarse al contenido en
    // los tickets normales (que casi siempre superan el ancho del rollo).
    const altoMm = Math.max(altoContenidoMm, ANCHO_ROLLO_MM + 1);

    const style = document.createElement("style");
    style.textContent = `@page { size: ${ANCHO_ROLLO_MM}mm ${altoMm}mm; margin: ${MARGEN_MM}mm; }`;
    document.head.appendChild(style);

    const limpiar = () => {
      style.remove();
      window.removeEventListener("afterprint", limpiar);
    };
    window.addEventListener("afterprint", limpiar);
    window.print();
  }

  return (
    <div className="ticket-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div ref={ticketRef} className="ticket-imprimible w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-lg sm:rounded-2xl">
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
            onClick={imprimir}
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
