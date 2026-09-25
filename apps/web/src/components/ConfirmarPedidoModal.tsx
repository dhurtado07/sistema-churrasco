import { useState } from "react";
import type { Pedido } from "shared";
import { Modal } from "./Modal";
import { IconAlerta } from "./icons";
import { iconoComida } from "./ImagenProducto";
import { lineasDelPedido } from "../lib/pedidosDisplay";

/**
 * Popup de confirmación en el medio de la pantalla, con el detalle del
 * pedido, antes de marcar "Listo" o "Entregado" — para que cocina/parrilla/
 * entrega no lo hagan por error tocando el botón sin querer.
 */
export function ConfirmarPedidoModal({
  pedido,
  titulo,
  pregunta,
  textoConfirmar,
  error,
  onConfirmar,
  onCancelar,
  destructivo,
}: {
  pedido: Pedido;
  titulo: string;
  pregunta: string;
  textoConfirmar: string;
  /** Error de un intento anterior (p. ej. el servidor ocupado) — se muestra
   * arriba de los botones para que quien confirma sepa que hay que reintentar,
   * en vez de que el popup se cierre sin explicación. */
  error?: string | null;
  onConfirmar: () => Promise<void>;
  onCancelar: () => void;
  /** true para una acción que no se puede deshacer (ej. anular un pedido) —
   * el botón de confirmar sale en rojo en vez del verde de "todo bien",
   * como el resto de los botones destructivos de la app. */
  destructivo?: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);

  async function confirmar() {
    setConfirmando(true);
    try {
      await onConfirmar();
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <Modal titulo={titulo} onCerrar={onCancelar}>
      <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-800">
        <IconAlerta width={20} height={20} className="mt-0.5 shrink-0" />
        <p className="text-sm">{pregunta}</p>
      </div>

      <p className="mb-1 text-sm font-semibold text-neutral-900">Ticket #{pedido.numeroTicket}</p>
      {pedido.clienteNombre && (
        <p className="mb-2 text-sm text-neutral-600">Cliente: {pedido.clienteNombre}</p>
      )}

      <ul className="mb-4 divide-y divide-neutral-100 rounded-lg border border-neutral-100">
        {lineasDelPedido(pedido.items).map((linea) => {
          // Ícono por tipo de comida (mismo criterio que ImagenProducto en
          // Caja) — para reconocer de un vistazo qué es cada línea (plato o
          // extra) sin tener que leer el nombre completo.
          const IconoTipo = iconoComida(linea.nombre);
          return (
            <li key={linea.key} className="flex items-center gap-2.5 px-3 py-2 text-sm">
              <IconoTipo width={20} height={20} className="shrink-0 text-neutral-500" />
              <span className="font-medium text-neutral-900">
                {linea.cantidad}x {linea.nombre}
              </span>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <IconAlerta width={16} height={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancelar}
          className="flex-1 rounded-lg bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-700"
        >
          Cancelar
        </button>
        <button
          onClick={confirmar}
          disabled={confirmando}
          className={`flex-1 rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 ${
            destructivo ? "bg-red-600" : "bg-emerald-600"
          }`}
        >
          {confirmando ? "Confirmando…" : textoConfirmar}
        </button>
      </div>
    </Modal>
  );
}
