import { useEffect, useMemo, useState } from "react";
import type { Pedido } from "shared";
import { SOCKET_EVENTS } from "shared";
import { Modal } from "./Modal";
import { IconInput } from "./IconInput";
import { IconPedidos, IconSearch } from "./icons";
import { useAuth } from "../lib/auth";
import { useSocket } from "../lib/socketContext";
import { useConfiguracion } from "../lib/configuracionContext";
import { apiFetch } from "../lib/api";
import { formatBs, formatoFechaHoraBO } from "../lib/format";
import { ESTADO_BADGE, ESTADO_LABEL, TABS_PEDIDOS, type FiltroPedidos } from "../lib/pedidosDisplay";

/**
 * Botón + modal de "Ver pedidos", disponible en todas las estaciones (Caja,
 * Cocina, Parrilla, Entrega) vía EstacionHeader — de solo lectura (ninguna
 * acción de editar/anular acá, eso sigue siendo cosa de Caja/Admin). Sirve
 * sobre todo para revisar qué se entregó, o en qué anda un pedido, sin tener
 * que preguntarle a otra estación.
 */
export function VerPedidosModal() {
  const { token } = useAuth();
  const socket = useSocket();
  const { configuracion } = useConfiguracion();
  const [abierto, setAbierto] = useState(false);
  const [tab, setTab] = useState<FiltroPedidos>("atendidos");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  function cargar() {
    setCargando(true);
    apiFetch<Pedido[]>(`/pedidos?estado=${tab}`, token)
      .then(setPedidos)
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    if (!abierto) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, tab, token]);

  useEffect(() => {
    if (!abierto || !socket) return;
    // Cualquier cambio de estado puede mover un pedido entre pestañas — más
    // simple recargar la pestaña activa que tratar de parchear en el cliente.
    const onCambio = () => cargar();
    socket.on(SOCKET_EVENTS.PEDIDO_NUEVO, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_ACTUALIZADO, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_CANCELADO, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_COCINA_LISTA, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_PARRILLA_LISTA, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_COMPLETADO, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_ENTREGADO, onCambio);
    return () => {
      socket.off(SOCKET_EVENTS.PEDIDO_NUEVO, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_ACTUALIZADO, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_CANCELADO, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_COCINA_LISTA, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_PARRILLA_LISTA, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_COMPLETADO, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_ENTREGADO, onCambio);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, socket, tab]);

  const pedidosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return pedidos;
    return pedidos.filter(
      (p) =>
        String(p.folio).includes(termino) ||
        p.clienteNombre?.toLowerCase().includes(termino) ||
        p.mesa?.toLowerCase().includes(termino),
    );
  }, [pedidos, busqueda]);

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1.5 rounded-lg bg-neutral-700 px-3 py-2 text-sm font-medium active:bg-neutral-600"
      >
        <IconPedidos width={16} height={16} />
        Ver pedidos
      </button>

      {abierto && (
        <Modal titulo="Pedidos" onCerrar={() => setAbierto(false)}>
          <div className="mb-3 flex gap-1.5 overflow-x-auto">
            {TABS_PEDIDOS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  tab === t.key ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <IconInput
            icon={IconSearch}
            placeholder="Buscar por ticket, cliente o mesa…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="mb-3"
          />

          {cargando && <p className="text-sm text-neutral-400">Cargando…</p>}
          {!cargando && pedidosFiltrados.length === 0 && (
            <p className="text-sm text-neutral-400">
              {pedidos.length === 0
                ? `No hay pedidos en "${TABS_PEDIDOS.find((t) => t.key === tab)?.label}".`
                : "Ningún pedido coincide con la búsqueda."}
            </p>
          )}

          <ul className="max-h-[55vh] space-y-2.5 overflow-y-auto">
            {pedidosFiltrados.map((pedido) => (
              <li key={pedido.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-bold text-neutral-900">#{pedido.folio}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO_BADGE[pedido.estado]}`}>
                    {ESTADO_LABEL[pedido.estado]}
                  </span>
                </div>
                <p className="mb-1.5 text-xs text-neutral-500">
                  {pedido.tipoConsumo === "LOCAL"
                    ? configuracion.mesaHabilitada
                      ? `Mesa ${pedido.mesa ?? "?"}`
                      : "En el local"
                    : "Para llevar"}
                  {pedido.clienteNombre ? ` · ${pedido.clienteNombre}` : ""} · {formatoFechaHoraBO(pedido.creadoEn)}
                </p>
                <ul className="mb-1.5 space-y-0.5 text-xs text-neutral-700">
                  {pedido.items.map((item) => (
                    <li key={item.id}>
                      {item.cantidad}x {item.nombreProducto}
                      {item.extras.length > 0 && (
                        <span className="text-neutral-400"> ({item.extras.map((e) => e.nombre).join(", ")})</span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-right text-sm font-semibold text-neutral-900">Bs {formatBs(pedido.total)}</p>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}
