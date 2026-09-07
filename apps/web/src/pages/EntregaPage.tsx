import { useEffect, useState } from "react";
import type { Pedido } from "shared";
import { SOCKET_EVENTS } from "shared";
import { EstacionHeader } from "../components/EstacionHeader";
import { useAuth } from "../lib/auth";
import { apiFetch, ApiError } from "../lib/api";
import { useSocket } from "../lib/socketContext";
import { IconBag, IconCheck, IconIdCard, IconMesa, IconUser } from "../components/icons";
import { ConfirmarPedidoModal } from "../components/ConfirmarPedidoModal";

function listoParaEntregar(pedido: Pedido): boolean {
  return pedido.estado === "COMPLETADO";
}

export function EntregaPage() {
  const { token } = useAuth();
  const socket = useSocket();
  const [cola, setCola] = useState<Pedido[]>([]);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [pedidoAConfirmar, setPedidoAConfirmar] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Pedido[]>("/pedidos/cola?estacion=entrega", token).then(setCola);
  }, [token]);

  useEffect(() => {
    if (!socket) return;

    // Un mismo evento sirve para altas, bajas y actualizaciones: si el pedido
    // sigue activo (pagado o listo) lo agrega/actualiza; si ya se entregó,
    // canceló, o no corresponde, lo saca de la lista.
    const actualizar = (pedido: Pedido) => {
      setCola((prev) => {
        const yaEsta = prev.some((p) => p.id === pedido.id);
        const activo = pedido.estado === "PAGADO" || pedido.estado === "COMPLETADO";
        if (!activo) return yaEsta ? prev.filter((p) => p.id !== pedido.id) : prev;
        return yaEsta ? prev.map((p) => (p.id === pedido.id ? pedido : p)) : [...prev, pedido];
      });
    };
    const resincronizar = () => {
      apiFetch<Pedido[]>("/pedidos/cola?estacion=entrega", token).then(setCola);
    };

    socket.on(SOCKET_EVENTS.PEDIDO_NUEVO, actualizar);
    socket.on(SOCKET_EVENTS.PEDIDO_ACTUALIZADO, actualizar);
    socket.on(SOCKET_EVENTS.PEDIDO_CANCELADO, actualizar);
    socket.on(SOCKET_EVENTS.PEDIDO_COCINA_LISTA, actualizar);
    socket.on(SOCKET_EVENTS.PEDIDO_PARRILLA_LISTA, actualizar);
    socket.on(SOCKET_EVENTS.PEDIDO_COMPLETADO, actualizar);
    socket.on(SOCKET_EVENTS.PEDIDO_ENTREGADO, actualizar);
    socket.on("connect", resincronizar);

    return () => {
      socket.off(SOCKET_EVENTS.PEDIDO_NUEVO, actualizar);
      socket.off(SOCKET_EVENTS.PEDIDO_ACTUALIZADO, actualizar);
      socket.off(SOCKET_EVENTS.PEDIDO_CANCELADO, actualizar);
      socket.off(SOCKET_EVENTS.PEDIDO_COCINA_LISTA, actualizar);
      socket.off(SOCKET_EVENTS.PEDIDO_PARRILLA_LISTA, actualizar);
      socket.off(SOCKET_EVENTS.PEDIDO_COMPLETADO, actualizar);
      socket.off(SOCKET_EVENTS.PEDIDO_ENTREGADO, actualizar);
      socket.off("connect", resincronizar);
    };
  }, [socket, token]);

  async function marcarEntregado(pedido: Pedido) {
    setMarcando(pedido.id);
    setError(null);
    try {
      await apiFetch(`/pedidos/${pedido.folio}/entregar`, token, { method: "PATCH" });
      setCola((prev) => prev.filter((p) => p.id !== pedido.id));
      setPedidoAConfirmar(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo confirmar la entrega. Probá de nuevo.");
    } finally {
      setMarcando(null);
    }
  }

  return (
    <div className="min-h-dvh bg-neutral-100">
      <EstacionHeader titulo="Entrega" />

      <div className="grid grid-cols-1 gap-4 p-3 sm:p-4 md:grid-cols-2 xl:grid-cols-3">
        {cola.length === 0 && (
          <p className="col-span-full text-center text-base text-neutral-400">
            No hay pedidos en camino.
          </p>
        )}

        {cola.map((pedido, index) => {
          const listo = listoParaEntregar(pedido);
          return (
            <article key={pedido.id} className="overflow-hidden rounded-2xl border-2 border-neutral-900 bg-white shadow-xl">
              <div className={`flex items-center gap-3 px-4 py-3 ${listo ? "bg-emerald-700" : "bg-neutral-900"}`}>
                <span
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-3xl font-black ${listo ? "text-emerald-700" : "text-neutral-900"}`}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-white">Ticket #{pedido.folio}</p>
                  <p className={`flex items-center gap-1 text-sm ${listo ? "text-emerald-100" : "text-neutral-300"}`}>
                    {pedido.tipoConsumo === "LOCAL" ? (
                      <IconMesa width={14} height={14} />
                    ) : (
                      <IconBag width={14} height={14} />
                    )}
                    {pedido.tipoConsumo === "LOCAL" ? `Mesa ${pedido.mesa ?? "?"}` : "Para llevar"}
                  </p>
                </div>
              </div>

              <div className="p-4">
                {pedido.clienteNombre ? (
                  <div className="mb-3 rounded-xl bg-neutral-50 p-3">
                    <p className="flex items-center gap-1.5 text-xl font-bold text-neutral-900">
                      <IconUser width={18} height={18} className="text-neutral-500" />
                      {pedido.clienteNombre}
                    </p>
                    {pedido.clienteCarnet && (
                      <p className="mt-1 flex items-center gap-1.5 text-base text-neutral-600">
                        <IconIdCard width={16} height={16} className="text-neutral-400" />
                        Carnet {pedido.clienteCarnet}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mb-3 text-base text-neutral-400">
                    Sin cliente registrado — llamar por el ticket #{pedido.folio}.
                  </p>
                )}

                <ul className="mb-3 divide-y divide-neutral-100">
                  {pedido.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-2 first:pt-0">
                      {item.imagenUrl ? (
                        <img src={item.imagenUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="h-14 w-14 shrink-0 rounded-lg bg-neutral-100" />
                      )}
                      <div className="min-w-0">
                        <p className="text-lg font-semibold text-neutral-900">
                          {item.cantidad}x {item.nombreProducto}
                        </p>
                        {item.extras.length > 0 && (
                          <p className="text-sm text-neutral-500">
                            {item.extras.map((extra) => extra.nombre).join(", ")}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Estado de preparación — el botón recién se habilita cuando
                    cocina Y parrilla (si aplica) ya terminaron. */}
                <div className="mb-3 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      pedido.cocinaLista ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    Cocina: {pedido.cocinaLista ? "listo" : "en preparación"}
                  </span>
                  {pedido.requiereParrilla && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        pedido.parrillaLista ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      Parrilla: {pedido.parrillaLista ? "lista" : "en preparación"}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    setError(null);
                    setPedidoAConfirmar(pedido);
                  }}
                  disabled={!listo || marcando === pedido.id}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-4 text-lg font-bold text-white active:bg-emerald-700 disabled:bg-neutral-200 disabled:text-neutral-400"
                >
                  <IconCheck width={20} height={20} />
                  {marcando === pedido.id
                    ? "Marcando…"
                    : listo
                      ? "Entregado"
                      : "Esperando cocina/parrilla"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {pedidoAConfirmar && (
        <ConfirmarPedidoModal
          pedido={pedidoAConfirmar}
          titulo="Confirmar entrega"
          pregunta={
            pedidoAConfirmar.tipoConsumo === "LOCAL"
              ? `¿Ya le llevaste el pedido a la mesa ${pedidoAConfirmar.mesa ?? "?"}${pedidoAConfirmar.clienteNombre ? ` (${pedidoAConfirmar.clienteNombre})` : ""}?`
              : `¿Ya le entregaste el pedido a ${pedidoAConfirmar.clienteNombre ?? "el cliente"}? Verificá que te haya dado el ticket #${pedidoAConfirmar.folio}.`
          }
          textoConfirmar="Sí, ya se entregó"
          error={error}
          onConfirmar={() => marcarEntregado(pedidoAConfirmar)}
          onCancelar={() => {
            setError(null);
            setPedidoAConfirmar(null);
          }}
        />
      )}
    </div>
  );
}
