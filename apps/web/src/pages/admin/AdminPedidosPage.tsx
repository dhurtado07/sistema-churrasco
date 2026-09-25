import { useEffect, useState } from "react";
import type { Pedido } from "shared";
import { SOCKET_EVENTS, codigoPedido, coincideConCodigo, hoyBolivia, inicioDelDiaBolivia } from "shared";
import { useListaRemota } from "../../lib/useListaRemota";
import { EstadoCargaLista } from "../../components/EstadoCargaLista";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { useSocket } from "../../lib/socketContext";
import { useConfiguracion } from "../../lib/configuracionContext";
import { formatBs, formatoFechaHoraBO } from "../../lib/format";
import { IconAsistencia, IconCheck, IconEdit, IconPrint, IconRefresh, IconSearch, IconTrash } from "../../components/icons";
import { IconInput } from "../../components/IconInput";
import { EditarPedidoModal } from "./EditarPedidoModal";
import { HistorialPedidoModal } from "./HistorialPedidoModal";
import { ConfirmarPedidoModal } from "../../components/ConfirmarPedidoModal";
import { TicketModal } from "../../components/TicketModal";
import { FiltroChip } from "../../components/TablaSeccion";
import {
  ESTADO_BADGE,
  ESTADO_LABEL,
  formatoExtra,
  puedeModificarse,
  TABS_PEDIDOS,
  type FiltroPedidos as Filtro,
} from "../../lib/pedidosDisplay";

const TABS = TABS_PEDIDOS;

// "YYYY-MM-DD" de hoy en Bolivia — lo que espera un <input type="date">.
const hoyComoInputDate = hoyBolivia;

/** new Date("YYYY-MM-DD") lo interpreta como medianoche UTC, no medianoche
 * local — con Bolivia en UTC-4 eso corre el día entero para atrás. Partiendo
 * los componentes a mano y usando el constructor (año, mes, día), Date SÍ
 * los toma como hora local, sin ese corrimiento (mismo criterio que ya usa
 * Reportes). */
function fechaLocalDesdeInput(valor: string): Date {
  return inicioDelDiaBolivia(valor);
}

export function AdminPedidosPage() {
  const { token } = useAuth();
  const socket = useSocket();
  const { configuracion } = useConfiguracion();
  const [tab, setTab] = useState<Filtro>("pendientes");
  const [pedidoEditando, setPedidoEditando] = useState<Pedido | null>(null);
  const [pedidoHistorial, setPedidoHistorial] = useState<Pedido | null>(null);
  const [pedidoACancelar, setPedidoACancelar] = useState<Pedido | null>(null);
  const [pedidoTicket, setPedidoTicket] = useState<Pedido | null>(null);
  const [reimprimiendo, setReimprimiendo] = useState<number | null>(null);
  const [avisoReimpresion, setAvisoReimpresion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  // Por defecto se ve solo lo de hoy — un local que ya factura seguido
  // acumula demasiados pedidos como para mostrarlos todos juntos. "Rango
  // personalizado" lo saca de "hoy" para mirar cualquier otro día o período.
  const [rangoPersonalizado, setRangoPersonalizado] = useState(false);
  const [desdeManual, setDesdeManual] = useState(hoyComoInputDate());
  const [hastaManual, setHastaManual] = useState(hoyComoInputDate());
  const desde = fechaLocalDesdeInput(rangoPersonalizado ? desdeManual : hoyComoInputDate());
  const hasta = fechaLocalDesdeInput(rangoPersonalizado ? hastaManual : hoyComoInputDate());
  // Una respuesta vieja (otra pestaña u otro rango) nunca pisa la actual: lo
  // resuelve useListaRemota al cambiar la ruta.
  const {
    datos: pedidos,
    estado: estadoCarga,
    error: errorCarga,
    recargar: cargar,
  } = useListaRemota<Pedido>(
    `/pedidos?estado=${tab}&desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`,
    token,
  );

  useEffect(() => {
    if (!socket) return;
    // Cualquier cambio de estado de un pedido puede mover una fila entre
    // pestañas — más simple y confiable recargar la pestaña activa que tratar
    // de parchear el estado local para cada evento posible.
    const onCambio = () => cargar();
    // Al reconectar: los eventos perdidos mientras el socket estaba caído
    // dejarían la pestaña desactualizada.
    socket.on("connect", onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_NUEVO, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_ACTUALIZADO, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_CANCELADO, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_COCINA_LISTA, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_PARRILLA_LISTA, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_COMPLETADO, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_ENTREGADO, onCambio);
    return () => {
      socket.off("connect", onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_NUEVO, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_ACTUALIZADO, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_CANCELADO, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_COCINA_LISTA, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_PARRILLA_LISTA, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_COMPLETADO, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_ENTREGADO, onCambio);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, tab, rangoPersonalizado, desdeManual, hastaManual]);

  const pedidosFiltrados = pedidos.filter((pedido) => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return true;
    return (
      String(pedido.numeroTicket).includes(termino) ||
      coincideConCodigo(pedido.folio, termino) ||
      pedido.clienteNombre?.toLowerCase().includes(termino) ||
      pedido.mesa?.toLowerCase().includes(termino)
    );
  });

  async function cancelar(pedido: Pedido) {
    setError(null);
    try {
      await apiFetch(`/pedidos/${pedido.folio}/cancelar`, token, { method: "PATCH" });
      setPedidoACancelar(null);
      cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo anular el pedido");
      // Probablemente cambió de estado en otra pantalla: mostrar cómo está de verdad.
      cargar();
    }
  }

  async function reimprimir(pedido: Pedido) {
    setError(null);
    setReimprimiendo(pedido.folio);
    try {
      await apiFetch(`/pedidos/${pedido.folio}/reimprimir`, token, { method: "POST" });
      setAvisoReimpresion(`Ticket #${pedido.numeroTicket} reenviado a la impresora`);
      setTimeout(() => setAvisoReimpresion(null), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo reimprimir el ticket");
    } finally {
      setReimprimiendo(null);
    }
  }

  return (
    <div className="space-y-4 p-3 sm:p-4">
      {/* Todo lo de acá adentro se oculta al imprimir un ticket puntual (ver
          TicketModal) — si no, además del ticket salía toda esta lista de
          pedidos detrás. */}
      <div className="no-imprimir space-y-4">
      <h1 className="text-lg font-semibold text-neutral-900">Pedidos</h1>

      {avisoReimpresion && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{avisoReimpresion}</div>
      )}
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

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

      <div className="flex flex-wrap items-center gap-2">
        <FiltroChip activo={!rangoPersonalizado} acento="azul" onClick={() => setRangoPersonalizado(false)}>
          Hoy
        </FiltroChip>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={desdeManual}
            onChange={(e) => {
              setDesdeManual(e.target.value);
              setRangoPersonalizado(true);
            }}
            className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
          />
          <span className="text-xs text-neutral-400">a</span>
          <input
            type="date"
            value={hastaManual}
            onChange={(e) => {
              setHastaManual(e.target.value);
              setRangoPersonalizado(true);
            }}
            className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
          />
        </div>
      </div>

      <IconInput
        icon={IconSearch}
        placeholder="Buscar por ticket, cliente o mesa…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="sm:max-w-xs"
      />

      <div className="space-y-3">
        {pedidos.length === 0 ? (
          <EstadoCargaLista
            estado={estadoCarga}
            error={errorCarga}
            vacio={`No hay pedidos en "${TABS.find((t) => t.key === tab)?.label}".`}
            className="text-sm"
          />
        ) : (
          pedidosFiltrados.length === 0 && (
            <p className="text-sm text-neutral-400">Ningún pedido coincide con la búsqueda.</p>
          )
        )}

        {pedidosFiltrados.map((pedido) => (
          <article key={pedido.id} className="rounded-2xl border-2 border-neutral-900 bg-white p-4 shadow-xl">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-neutral-900">Ticket #{pedido.numeroTicket}</span>
                <span className="ml-2 text-xs text-neutral-500">
                  {codigoPedido(pedido.folio)} · {formatoFechaHoraBO(pedido.creadoEn)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Un Pedido solo existe en la base a partir del cobro exitoso
                    (ver crearPedido) — así que salvo que se haya anulado
                    después, "existe" y "está pagado" son lo mismo. Se muestra
                    igual de forma explícita para que quede clarísimo a
                    simple vista, sin tener que inferirlo del estado de cocina. */}
                {pedido.estado !== "CANCELADO" && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    <IconCheck width={12} height={12} />
                    Pagado
                  </span>
                )}
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ESTADO_BADGE[pedido.estado]}`}>
                  {ESTADO_LABEL[pedido.estado]}
                </span>
              </div>
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
                    <span className="text-neutral-400"> ({item.extras.map(formatoExtra).join(", ")})</span>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-neutral-900">Bs {formatBs(pedido.total)}</span>

              <div className="flex flex-wrap gap-2">
                {pedido.estado !== "CANCELADO" && (
                  <>
                    <button
                      onClick={() => setPedidoTicket(pedido)}
                      title="Ver el ticket en pantalla"
                      className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-600"
                    >
                      <IconPrint width={14} height={14} />
                      Ticket
                    </button>
                    <button
                      onClick={() => reimprimir(pedido)}
                      disabled={reimprimiendo === pedido.folio}
                      title="Reenviar el ticket a la impresora térmica (por si la impresora falló o el cliente pide otra copia)"
                      className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-600 disabled:opacity-50"
                    >
                      <IconRefresh width={14} height={14} />
                      {reimprimiendo === pedido.folio ? "Enviando…" : "Reimprimir"}
                    </button>
                  </>
                )}
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
                  {puedeModificarse(pedido, configuracion) ? (
                    <>
                      <button
                        onClick={() => setPedidoEditando(pedido)}
                        className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium"
                      >
                        <IconEdit width={14} height={14} />
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          setError(null);
                          setPedidoACancelar(pedido);
                        }}
                        className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 disabled:opacity-50"
                      >
                        <IconTrash width={14} height={14} />
                        Anular
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
      {pedidoTicket && <TicketModal pedido={pedidoTicket} onCerrar={() => setPedidoTicket(null)} />}
      {pedidoACancelar && (
        <ConfirmarPedidoModal
          pedido={pedidoACancelar}
          titulo="Anular pedido"
          pregunta={`¿Anular el ticket #${pedidoACancelar.numeroTicket}? Esto no se puede deshacer.`}
          textoConfirmar="Sí, anular"
          destructivo
          error={error}
          onConfirmar={() => cancelar(pedidoACancelar)}
          onCancelar={() => {
            setError(null);
            setPedidoACancelar(null);
          }}
        />
      )}
    </div>
  );
}
