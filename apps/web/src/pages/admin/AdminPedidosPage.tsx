import { useEffect, useRef, useState } from "react";
import type { Pedido } from "shared";
import { SOCKET_EVENTS } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { useSocket } from "../../lib/socketContext";
import { useConfiguracion } from "../../lib/configuracionContext";
import { formatBs, formatoFechaHoraBO } from "../../lib/format";
import { IconAsistencia, IconCheck, IconEdit, IconSearch, IconTrash } from "../../components/icons";
import { IconInput } from "../../components/IconInput";
import { EditarPedidoModal } from "./EditarPedidoModal";
import { HistorialPedidoModal } from "./HistorialPedidoModal";
import {
  ESTADO_BADGE,
  ESTADO_LABEL,
  puedeModificarse,
  TABS_PEDIDOS,
  type FiltroPedidos as Filtro,
} from "../../lib/pedidosDisplay";

const TABS = TABS_PEDIDOS;

export function AdminPedidosPage() {
  const { token } = useAuth();
  const socket = useSocket();
  const { configuracion } = useConfiguracion();
  const [tab, setTab] = useState<Filtro>("pendientes");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pedidoEditando, setPedidoEditando] = useState<Pedido | null>(null);
  const [pedidoHistorial, setPedidoHistorial] = useState<Pedido | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  // React (StrictMode) puede disparar el efecto de carga dos veces, y un
  // cambio rápido de pestaña puede dejar una petición vieja todavía en
  // vuelo. Si esa respuesta vieja llega después de la de la pestaña actual,
  // no debe pisar los datos correctos — por eso se descarta si `tab` ya
  // cambió quiere decir que la respuesta pertenece a otra pestaña.
  const tabRef = useRef(tab);
  tabRef.current = tab;

  async function cargar() {
    const tabAlPedir = tab;
    setCargando(true);
    try {
      const data = await apiFetch<Pedido[]>(`/pedidos?estado=${tabAlPedir}`, token);
      if (tabRef.current === tabAlPedir) setPedidos(data);
    } finally {
      if (tabRef.current === tabAlPedir) setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, token]);

  useEffect(() => {
    if (!socket) return;
    // Cualquier cambio de estado de un pedido puede mover una fila entre
    // pestañas — más simple y confiable recargar la pestaña activa que tratar
    // de parchear el estado local para cada evento posible.
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
  }, [socket, tab]);

  const pedidosFiltrados = pedidos.filter((pedido) => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return true;
    return (
      String(pedido.folio).includes(termino) ||
      pedido.clienteNombre?.toLowerCase().includes(termino) ||
      pedido.mesa?.toLowerCase().includes(termino)
    );
  });

  async function cancelar(pedido: Pedido) {
    if (!confirm(`¿Anular el ticket #${pedido.folio}? Esto no se puede deshacer.`)) return;
    setCancelando(pedido.id);
    setError(null);
    try {
      await apiFetch(`/pedidos/${pedido.folio}/cancelar`, token, { method: "PATCH" });
      cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo anular el pedido");
    } finally {
      setCancelando(null);
    }
  }

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <h1 className="text-lg font-semibold text-neutral-900">Pedidos</h1>

      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium ${
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
        className="sm:max-w-xs"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {cargando && <p className="text-sm text-neutral-400">Cargando…</p>}
        {!cargando && pedidosFiltrados.length === 0 && (
          <p className="text-sm text-neutral-400">
            {pedidos.length === 0
              ? `No hay pedidos en "${TABS.find((t) => t.key === tab)?.label}".`
              : "Ningún pedido coincide con la búsqueda."}
          </p>
        )}

        {pedidosFiltrados.map((pedido) => (
          <article key={pedido.id} className="rounded-2xl border-2 border-neutral-900 bg-white p-4 shadow-xl">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-neutral-900">Ticket #{pedido.folio}</span>
                <span className="ml-2 text-xs text-neutral-500">
                  {formatoFechaHoraBO(pedido.creadoEn)}
                </span>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ESTADO_BADGE[pedido.estado]}`}>
                {ESTADO_LABEL[pedido.estado]}
              </span>
            </div>

            <p className="mb-1 text-sm text-neutral-500">
              {pedido.tipoConsumo === "LOCAL"
                ? configuracion.mesaHabilitada
                  ? `Mesa ${pedido.mesa ?? "?"}`
                  : "En el local"
                : "Para llevar"}
              {pedido.clienteNombre ? ` · ${pedido.clienteNombre}` : ""} · Cajero: {pedido.cajeroUsername}
            </p>

            <ul className="mb-3 mt-2 space-y-1 text-sm text-neutral-700">
              {pedido.items.map((item) => (
                <li key={item.id}>
                  {item.cantidad}x {item.nombreProducto}
                  {item.extras.length > 0 && (
                    <span className="text-neutral-400"> ({item.extras.map((e) => e.nombre).join(", ")})</span>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-neutral-900">Bs {formatBs(pedido.total)}</span>

              <div className="flex gap-2">
                <button
                  onClick={() => setPedidoHistorial(pedido)}
                  title="Ver historial de ediciones/anulación"
                  className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-600"
                >
                  <IconAsistencia width={14} height={14} />
                  Historial
                </button>
                {tab === "pendientes" && (
                <>
                  {puedeModificarse(pedido) ? (
                    <>
                      <button
                        onClick={() => setPedidoEditando(pedido)}
                        className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium"
                      >
                        <IconEdit width={14} height={14} />
                        Editar
                      </button>
                      <button
                        onClick={() => cancelar(pedido)}
                        disabled={cancelando === pedido.id}
                        className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 disabled:opacity-50"
                      >
                        <IconTrash width={14} height={14} />
                        {cancelando === pedido.id ? "Anulando…" : "Anular"}
                      </button>
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-neutral-400">
                      <IconCheck width={14} height={14} />
                      Ya en preparación
                    </span>
                  )}
                </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {pedidoEditando && (
        <EditarPedidoModal
          pedido={pedidoEditando}
          token={token}
          onCerrar={() => setPedidoEditando(null)}
          onGuardado={() => {
            setPedidoEditando(null);
            cargar();
          }}
        />
      )}
      {pedidoHistorial && (
        <HistorialPedidoModal pedido={pedidoHistorial} onCerrar={() => setPedidoHistorial(null)} />
      )}
    </div>
  );
}
