import { useEffect, useMemo, useState } from "react";
import type { Cliente, Extra, MetodoPago, Pedido, Producto, TipoConsumo } from "shared";
import { SOCKET_EVENTS } from "shared";
import { EstacionHeader } from "../components/EstacionHeader";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";
import { useSocket } from "../lib/socketContext";
import { ClienteModal } from "./admin/AdminClientesPage";
import { useCarrito } from "../lib/useCarrito";
import { useConfiguracion } from "../lib/configuracionContext";
import { IconInput } from "../components/IconInput";
import {
  IconBag,
  IconCheck,
  IconCoin,
  IconHome,
  IconMesa,
  IconMinus,
  IconPlus,
  IconPrint,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUser,
} from "../components/icons";

const METODOS_PAGO: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: "EFECTIVO", etiqueta: "Efectivo" },
  { valor: "TARJETA", etiqueta: "Tarjeta" },
  { valor: "TRANSFERENCIA", etiqueta: "Transferencia" },
  { valor: "QR", etiqueta: "QR" },
];

export function CajaPage() {
  const { token } = useAuth();
  const socket = useSocket();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const { carrito, setCarrito, agregarProducto, cambiarCantidad, toggleExtra, quitarLinea, total } =
    useCarrito(extras);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [resultadosCliente, setResultadosCliente] = useState<Cliente[]>([]);
  const [modalClienteAbierto, setModalClienteAbierto] = useState(false);
  const [tipoConsumo, setTipoConsumo] = useState<TipoConsumo>("LOCAL");
  const [mesa, setMesa] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("EFECTIVO");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ultimoTicket, setUltimoTicket] = useState<Pedido | null>(null);

  useEffect(() => {
    apiFetch<{ productos: Producto[]; extras: Extra[] }>("/menu", token).then((data) => {
      setProductos(data.productos);
      setExtras(data.extras);
    });
  }, [token]);

  useEffect(() => {
    if (!socket) return;
    const onMenu = (payload: { productos: Producto[]; extras: Extra[] }) => {
      setProductos(payload.productos.filter((p) => p.activo));
      setExtras(payload.extras.filter((e) => e.activo));
    };
    socket.on(SOCKET_EVENTS.MENU_ACTUALIZADO, onMenu);
    return () => {
      socket.off(SOCKET_EVENTS.MENU_ACTUALIZADO, onMenu);
    };
  }, [socket]);

  useEffect(() => {
    if (!busquedaCliente.trim()) {
      setResultadosCliente([]);
      return;
    }
    const timeout = setTimeout(() => {
      apiFetch<Cliente[]>(`/clientes?q=${encodeURIComponent(busquedaCliente)}`, token).then(setResultadosCliente);
    }, 250);
    return () => clearTimeout(timeout);
  }, [busquedaCliente, token]);

  function seleccionarCliente(cliente: Cliente) {
    setClienteSeleccionado(cliente);
    setBusquedaCliente("");
    setResultadosCliente([]);
  }

  const categorias = useMemo(() => {
    const grupos = new Map<string, Producto[]>();
    for (const producto of productos) {
      const lista = grupos.get(producto.categoria) ?? [];
      lista.push(producto);
      grupos.set(producto.categoria, lista);
    }
    return [...grupos.entries()];
  }, [productos]);

  async function cobrar() {
    if (carrito.length === 0) return;
    if (tipoConsumo === "LOCAL" && !mesa.trim()) {
      setError("Indicá el número de mesa antes de cobrar.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const pedido = await apiFetch<Pedido>("/pedidos", token, {
        method: "POST",
        body: JSON.stringify({
          clienteId: clienteSeleccionado?.id,
          tipoConsumo,
          mesa: tipoConsumo === "LOCAL" ? mesa.trim() : undefined,
          metodoPago,
          items: carrito.map((linea) => ({
            productoId: linea.productoId,
            cantidad: linea.cantidad,
            extraIds: linea.extraIds,
          })),
        }),
      });
      setUltimoTicket(pedido);
      setCarrito([]);
      setClienteSeleccionado(null);
      setTipoConsumo("LOCAL");
      setMesa("");
      setMetodoPago("EFECTIVO");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el pedido");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-dvh bg-neutral-100">
      <EstacionHeader titulo="Caja" />

      <div className="grid grid-cols-1 gap-4 p-3 sm:p-4 lg:grid-cols-[1fr_380px]">
        {/* Menú */}
        <div className="space-y-5">
          {categorias.map(([categoria, items]) => (
            <section key={categoria}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                {categoria}
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {items.map((producto) => (
                  <button
                    key={producto.id}
                    onClick={() => agregarProducto(producto)}
                    className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white text-left shadow-sm active:scale-[0.98] active:bg-neutral-50"
                  >
                    <span className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-white shadow">
                      <IconPlus width={14} height={14} />
                    </span>
                    {producto.imagenUrl && (
                      <img
                        src={producto.imagenUrl}
                        alt={producto.nombre}
                        className="h-20 w-full object-cover"
                      />
                    )}
                    <div className="p-3">
                      <p className="font-medium text-neutral-900">{producto.nombre}</p>
                      <p className="text-sm text-neutral-500">Bs {producto.precio.toFixed(2)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {productos.length === 0 && (
            <p className="text-sm text-neutral-500">Cargando menú…</p>
          )}
        </div>

        {/* Carrito / cobro */}
        <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-4 lg:sticky lg:top-4 lg:h-fit">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Pedido actual
          </h2>

          {carrito.length === 0 && (
            <p className="text-sm text-neutral-400">Toca un plato del menú para agregarlo.</p>
          )}

          <ul className="space-y-3">
            {carrito.map((linea) => (
              <li key={linea.lineaId} className="rounded-lg border border-neutral-200 p-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-neutral-900">{linea.nombre}</p>
                  <button
                    onClick={() => quitarLinea(linea.lineaId)}
                    className="flex items-center gap-1 text-xs text-red-600"
                  >
                    <IconTrash width={14} height={14} />
                    Quitar
                  </button>
                </div>

                <div className="mt-1 flex items-center gap-2">
                  <button
                    onClick={() => cambiarCantidad(linea.lineaId, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200"
                  >
                    <IconMinus width={16} height={16} />
                  </button>
                  <span className="w-6 text-center">{linea.cantidad}</span>
                  <button
                    onClick={() => cambiarCantidad(linea.lineaId, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200"
                  >
                    <IconPlus width={16} height={16} />
                  </button>
                  <span className="ml-auto text-sm text-neutral-500">
                    Bs {(linea.precioUnitario * linea.cantidad).toFixed(2)}
                  </span>
                </div>

                {extras.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {extras.map((extra) => (
                      <label
                        key={extra.id}
                        className="flex items-center gap-1 rounded-full border border-neutral-200 py-1 pl-1 pr-2 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={linea.extraIds.includes(extra.id)}
                          onChange={() => toggleExtra(linea.lineaId, extra.id)}
                        />
                        {extra.imagenUrl && (
                          <img src={extra.imagenUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                        )}
                        {extra.nombre} (+Bs {extra.precio.toFixed(2)})
                      </label>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="border-t border-neutral-200 pt-3">
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Cliente (opcional)
            </label>

            {clienteSeleccionado ? (
              <div className="mb-3 flex items-center justify-between rounded-lg border border-neutral-300 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-neutral-900">{clienteSeleccionado.nombre}</p>
                  {clienteSeleccionado.carnet && (
                    <p className="text-xs text-neutral-500">Carnet {clienteSeleccionado.carnet}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setClienteSeleccionado(null)}
                  className="flex items-center gap-1 text-xs text-red-600"
                >
                  <IconTrash width={14} height={14} />
                  Quitar
                </button>
              </div>
            ) : (
              <div className="relative mb-3">
                <div className="flex gap-2">
                  <IconInput
                    icon={IconSearch}
                    placeholder="Buscar por nombre o carnet…"
                    value={busquedaCliente}
                    onChange={(e) => setBusquedaCliente(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setModalClienteAbierto(true)}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium"
                  >
                    <IconPlus width={14} height={14} />
                    Nuevo
                  </button>
                </div>
                {resultadosCliente.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-md">
                    {resultadosCliente.map((cliente) => (
                      <li key={cliente.id}>
                        <button
                          type="button"
                          onClick={() => seleccionarCliente(cliente)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50"
                        >
                          <IconUser width={14} height={14} className="shrink-0 text-neutral-400" />
                          <span className="font-medium">{cliente.nombre}</span>
                          {cliente.carnet && <span className="text-xs text-neutral-500">· {cliente.carnet}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mb-3 grid grid-cols-2 gap-2">
              {(["LOCAL", "LLEVAR"] as const).map((opcion) => {
                const Icon = opcion === "LOCAL" ? IconHome : IconBag;
                return (
                  <button
                    key={opcion}
                    onClick={() => setTipoConsumo(opcion)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                      tipoConsumo === opcion
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    <Icon width={16} height={16} />
                    {opcion === "LOCAL" ? "Para comer aquí" : "Para llevar"}
                  </button>
                );
              })}
            </div>

            {tipoConsumo === "LOCAL" && (
              <IconInput
                icon={IconMesa}
                className="mb-3"
                placeholder="Número de mesa"
                value={mesa}
                onChange={(e) => setMesa(e.target.value)}
              />
            )}

            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-600">
              <IconCoin width={14} height={14} />
              Método de pago
            </label>
            <div className="mb-3 grid grid-cols-4 gap-1.5">
              {METODOS_PAGO.map(({ valor, etiqueta }) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setMetodoPago(valor)}
                  className={`rounded-lg px-1.5 py-2 text-xs font-medium ${
                    metodoPago === valor ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>

            <div className="mb-3 flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span>Bs {total.toFixed(2)}</span>
            </div>

            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <button
              onClick={cobrar}
              disabled={carrito.length === 0 || enviando || (tipoConsumo === "LOCAL" && !mesa.trim())}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
            >
              <IconCheck width={18} height={18} />
              {enviando ? "Registrando…" : "Marcar como pagado"}
            </button>
          </div>
        </div>
      </div>

      {ultimoTicket && <TicketModal pedido={ultimoTicket} onCerrar={() => setUltimoTicket(null)} />}
      {modalClienteAbierto && (
        <ClienteModal
          token={token}
          onCerrar={() => setModalClienteAbierto(false)}
          onCreado={seleccionarCliente}
        />
      )}
    </div>
  );
}

function TicketModal({ pedido, onCerrar }: { pedido: Pedido; onCerrar: () => void }) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-lg sm:rounded-2xl">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {configuracion.nombreNegocio}
        </p>
        <h2 className="mb-1 text-lg font-bold">Ticket #{pedido.folio}</h2>
        <p className="mb-3 text-xs text-neutral-500">
          {pedido.tipoConsumo === "LOCAL" ? `Mesa ${pedido.mesa ?? "?"}` : "Para llevar"}
          {pedido.clienteNombre ? ` · ${pedido.clienteNombre}` : ""}
        </p>

        <ul className="mb-3 space-y-2 text-sm">
          {pedido.items.map((item) => (
            <li key={item.id}>
              <div className="flex justify-between">
                <span>
                  {item.cantidad}x {item.nombreProducto}
                </span>
                <span>Bs {(item.precioUnitario * item.cantidad).toFixed(2)}</span>
              </div>
              {item.extras.map((extra) => (
                <div key={extra.extraId} className="flex justify-between pl-4 text-xs text-neutral-500">
                  <span>+ {extra.nombre}</span>
                  <span>Bs {extra.precio.toFixed(2)}</span>
                </div>
              ))}
            </li>
          ))}
        </ul>

        <div className="mb-4 flex justify-between border-t border-neutral-200 pt-2 text-base font-bold">
          <span>Total</span>
          <span>Bs {pedido.total.toFixed(2)}</span>
        </div>

        {reimprimirError && <p className="mb-2 text-xs text-red-600">{reimprimirError}</p>}

        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-200 px-3 py-3 text-sm font-medium"
          >
            <IconPrint width={16} height={16} />
            Imprimir
          </button>
          <button
            onClick={reimprimir}
            disabled={reimprimiendo}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-200 px-3 py-3 text-sm font-medium disabled:opacity-50"
            title="Reenvía el ticket a la impresora térmica de la estación"
          >
            <IconRefresh width={16} height={16} />
            {reimprimiendo ? "Enviando…" : "Reimprimir"}
          </button>
          <button
            onClick={onCerrar}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-3 text-sm font-medium text-white"
          >
            <IconPlus width={16} height={16} />
            Nuevo pedido
          </button>
        </div>
      </div>
    </div>
  );
}
