import { useEffect, useState } from "react";
import type { Pedido } from "shared";
import { SOCKET_EVENTS } from "shared";
import { EstacionHeader } from "../components/EstacionHeader";
import { useAuth } from "../lib/auth";
import { apiFetch, ApiError } from "../lib/api";
import { useSocket } from "../lib/socketContext";
import { IconAlerta, IconCheck } from "../components/icons";
import { ConfirmarPedidoModal } from "../components/ConfirmarPedidoModal";
import { ImagenProducto } from "../components/ImagenProducto";
import { formatoFechaHoraBO } from "../lib/format";
import { useConfiguracion } from "../lib/configuracionContext";

interface Props {
  estacion: "cocina" | "parrilla";
  titulo: string;
}

export function ColaEstacionPage({ estacion, titulo }: Props) {
  const { token } = useAuth();
  const socket = useSocket();
  const { configuracion } = useConfiguracion();
  // El admin puede entrar acá aunque el módulo esté apagado (para revisar) —
  // sin este aviso, una cola vacía se confunde con "no llegan pedidos" en vez
  // de "está apagado a propósito".
  const moduloHabilitado = estacion === "cocina" ? configuracion.cocinaHabilitada : configuracion.parrillaHabilitada;
  const [cola, setCola] = useState<Pedido[]>([]);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [pedidoAConfirmar, setPedidoAConfirmar] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Pedido[]>(`/pedidos/cola?estacion=${estacion}`, token).then(setCola);
  }, [token, estacion]);

  useEffect(() => {
    if (!socket) return;

    const agregarSiCorresponde = (pedido: Pedido) => {
      if (estacion === "parrilla" && !pedido.requiereParrilla) return;
      setCola((prev) => (prev.some((p) => p.id === pedido.id) ? prev : [...prev, pedido]));
    };

    const quitarDeLaCola = (pedido: Pedido) => {
      setCola((prev) => prev.filter((p) => p.id !== pedido.id));
    };

    // Edición o cancelación: recalcula si el pedido sigue correspondiendo a
    // esta estación (pudo cambiar si ahora requiere o no parrilla) y si sigue
    // pendiente acá — si no, lo saca; si sí, actualiza su contenido en vivo.
    const actualizarEnCola = (pedido: Pedido) => {
      setCola((prev) => {
        const yaEsta = prev.some((p) => p.id === pedido.id);
        const corresponde = estacion === "parrilla" ? pedido.requiereParrilla : true;
        const pendienteAqui = estacion === "cocina" ? !pedido.cocinaLista : !pedido.parrillaLista;
        if (pedido.estado !== "PAGADO" || !corresponde || !pendienteAqui) {
          return yaEsta ? prev.filter((p) => p.id !== pedido.id) : prev;
        }
        return yaEsta ? prev.map((p) => (p.id === pedido.id ? pedido : p)) : [...prev, pedido];
      });
    };

    // Al (re)conectar (incluida una reconexión tras un corte) volvemos a
    // pedir el estado real de la cola por REST, para no quedarnos con una
    // vista desincronizada si se perdió algún evento mientras no había conexión.
    const resincronizar = () => {
      apiFetch<Pedido[]>(`/pedidos/cola?estacion=${estacion}`, token).then(setCola);
    };

    socket.on(SOCKET_EVENTS.PEDIDO_NUEVO, agregarSiCorresponde);
    socket.on(SOCKET_EVENTS.PEDIDO_COMPLETADO, quitarDeLaCola);
    socket.on(SOCKET_EVENTS.PEDIDO_ACTUALIZADO, actualizarEnCola);
    socket.on(SOCKET_EVENTS.PEDIDO_CANCELADO, actualizarEnCola);
    socket.on("connect", resincronizar);

    // Ambos eventos, en ambas estaciones: si es la propia rama, saca el
    // pedido de la cola (ya sea porque uno mismo lo marcó desde otra
    // terminal, o porque cocina/parrilla ya no está pendiente); si es la
    // rama contraria, solo actualiza la etiqueta de estado sin sacarlo.
    socket.on(SOCKET_EVENTS.PEDIDO_COCINA_LISTA, actualizarEnCola);
    socket.on(SOCKET_EVENTS.PEDIDO_PARRILLA_LISTA, actualizarEnCola);

    return () => {
      socket.off(SOCKET_EVENTS.PEDIDO_NUEVO, agregarSiCorresponde);
      socket.off(SOCKET_EVENTS.PEDIDO_COMPLETADO, quitarDeLaCola);
      socket.off(SOCKET_EVENTS.PEDIDO_ACTUALIZADO, actualizarEnCola);
      socket.off(SOCKET_EVENTS.PEDIDO_CANCELADO, actualizarEnCola);
      socket.off("connect", resincronizar);
      socket.off(SOCKET_EVENTS.PEDIDO_COCINA_LISTA, actualizarEnCola);
      socket.off(SOCKET_EVENTS.PEDIDO_PARRILLA_LISTA, actualizarEnCola);
    };
  }, [socket, estacion, token]);

  async function marcarListo(pedido: Pedido) {
    setMarcando(pedido.id);
    setError(null);
    try {
      await apiFetch(`/pedidos/${pedido.folio}/${estacion === "cocina" ? "cocina-lista" : "parrilla-lista"}`, token, {
        method: "PATCH",
      });
      setCola((prev) => prev.filter((p) => p.id !== pedido.id));
      setPedidoAConfirmar(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo marcar el pedido como listo. Probá de nuevo.");
    } finally {
      setMarcando(null);
    }
  }

  return (
    <div className="min-h-dvh bg-neutral-100">
      <EstacionHeader titulo={titulo} />

      {!moduloHabilitado && (
        <div className="mx-3 mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-800 sm:mx-4">
          <IconAlerta width={20} height={20} className="mt-0.5 shrink-0" />
          <p className="text-sm font-medium">
            Este módulo está desactivado por el administrador — no van a llegar pedidos nuevos acá hasta que se
            vuelva a activar en Configuración.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 p-3 sm:p-4 md:grid-cols-2 xl:grid-cols-3">
        {cola.length === 0 && (
          <p className="col-span-full text-center text-base text-neutral-400">
            No hay pedidos pendientes.
          </p>
        )}

        {cola.map((pedido) => (
          <article key={pedido.id} className="overflow-hidden rounded-2xl border-2 border-neutral-900 bg-white shadow-xl">
            {/* Antes mostraba la posición en la cola (1, 2, 3…) en un círculo
                grande — pero esa posición se reusa apenas se atiende el
                primero (el que queda pasa a ser "1" también), y se confundía
                con el número de ticket real. Ahora el único número grande es
                el folio del ticket, que es fijo y no se repite. */}
            <div className="flex items-center gap-3 bg-neutral-900 px-4 py-3">
              <div className="min-w-0">
                <p className="text-3xl font-black text-white">#{pedido.folio}</p>
                <p className="text-sm text-neutral-300">
                  {pedido.tipoConsumo === "LOCAL" ? "En local" : "Para llevar"} · {formatoFechaHoraBO(pedido.creadoEn)}
                </p>
              </div>
            </div>

            <div className="p-4">
              {pedido.clienteNombre && (
                <p className="mb-2 text-base text-neutral-500">Cliente: {pedido.clienteNombre}</p>
              )}

              <ul className="mb-4 divide-y divide-neutral-100">
                {pedido.items
                  .filter((item) => (estacion === "parrilla" ? item.requiereParrilla : true))
                  .map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                      <ImagenProducto
                        imagenUrl={item.imagenUrl}
                        nombre={item.nombreProducto}
                        className="h-16 w-16 shrink-0 rounded-xl"
                      />
                      <div className="min-w-0">
                        <p className="text-xl font-bold leading-tight text-neutral-900">
                          {item.cantidad}x {item.nombreProducto}
                        </p>
                        {item.extras.length > 0 && (
                          <p className="mt-0.5 text-base text-neutral-500">
                            {item.extras.map((extra) => extra.nombre).join(", ")}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>

              {/* Para que cocina y parrilla se vean entre sí: en cuanto una
                  rama marca "listo", la otra (y entrega) lo ven al instante. */}
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
                disabled={marcando === pedido.id}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-4 text-lg font-bold text-white active:bg-emerald-700 disabled:opacity-50"
              >
                <IconCheck width={20} height={20} />
                {marcando === pedido.id ? "Marcando…" : "Listo"}
              </button>
            </div>
          </article>
        ))}
      </div>

      {pedidoAConfirmar && (
        <ConfirmarPedidoModal
          pedido={pedidoAConfirmar}
          titulo={estacion === "cocina" ? "Confirmar plato listo" : "Confirmar parrilla lista"}
          pregunta={
            estacion === "cocina"
              ? "¿Ya sacaste el plato completo (guarniciones/extras)? Esto lo marca como listo en cocina."
              : "¿Ya pusiste la carne? Esto lo marca como listo en parrilla."
          }
          textoConfirmar="Sí, está listo"
          error={error}
          onConfirmar={() => marcarListo(pedidoAConfirmar)}
          onCancelar={() => {
            setError(null);
            setPedidoAConfirmar(null);
          }}
        />
      )}
    </div>
  );
}
