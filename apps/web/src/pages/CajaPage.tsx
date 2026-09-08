import { useEffect, useMemo, useState } from "react";
import type { Configuracion, Extra, MetodoPago, Pedido, Producto, TipoConsumo } from "shared";
import { SOCKET_EVENTS } from "shared";
import { EstacionHeader } from "../components/EstacionHeader";
import { Modal } from "../components/Modal";
import { useAuth } from "../lib/auth";
import { formatBs, formatoFechaHoraBO } from "../lib/format";
import { apiFetch, ApiError } from "../lib/api";
import { useSocket } from "../lib/socketContext";
import { puedeModificarse } from "../lib/pedidosDisplay";
import { useCarrito } from "../lib/useCarrito";
import { useConfiguracion } from "../lib/configuracionContext";
import { IconInput } from "../components/IconInput";
import { ImagenProducto } from "../components/ImagenProducto";
import {
  IconBag,
  IconCheck,
  IconCoin,
  IconHome,
  IconIdCard,
  IconMesa,
  IconMinus,
  IconPedidos,
  IconPlus,
  IconPrint,
  IconRefresh,
  IconTrash,
  IconUser,
} from "../components/icons";

// Orden fijo de las pestañas del menú: Platos primero (lo que más se pide),
// Bebidas después. Cualquier categoría no listada acá cae al final.
const ORDEN_CATEGORIA: Record<string, number> = { Platos: 0, Bebidas: 1 };

const METODOS_PAGO: { valor: MetodoPago; etiqueta: string; configKey: keyof Configuracion }[] = [
  { valor: "EFECTIVO", etiqueta: "Efectivo", configKey: "pagoEfectivoHabilitado" },
  { valor: "TARJETA", etiqueta: "Tarjeta", configKey: "pagoTarjetaHabilitado" },
  { valor: "TRANSFERENCIA", etiqueta: "Transferencia", configKey: "pagoTransferenciaHabilitado" },
  { valor: "QR", etiqueta: "QR", configKey: "pagoQrHabilitado" },
];

export function CajaPage() {
  const { token } = useAuth();
  const socket = useSocket();
  const { configuracion } = useConfiguracion();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const { carrito, setCarrito, agregarProducto, cambiarCantidad, toggleExtra, quitarLinea, total } =
    useCarrito(extras);
  // Nombre/CI del cliente: texto libre, no un registro formal — a Caja no le
  // interesa "registrar" a nadie, solo tener algo para llamarlo cuando esté
  // listo el pedido. Sale directo en el ticket (ver PedidoDTO.clienteNombre).
  const [clienteNombre, setClienteNombreInput] = useState("");
  const [clienteCarnet, setClienteCarnetInput] = useState("");
  const [tipoConsumo, setTipoConsumo] = useState<TipoConsumo>("LOCAL");
  const [mesa, setMesa] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("EFECTIVO");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ultimoTicket, setUltimoTicket] = useState<Pedido | null>(null);
  const [mostrandoQr, setMostrandoQr] = useState(false);
  const [mostrandoConfirmacion, setMostrandoConfirmacion] = useState(false);

  const metodosPagoDisponibles = useMemo(
    () => METODOS_PAGO.filter((m) => configuracion[m.configKey]),
    [configuracion],
  );

  // Si el método elegido deja de estar habilitado (el admin lo apagó justo
  // ahora, o es el primer render), pasar al primero que sí esté disponible.
  useEffect(() => {
    if (metodosPagoDisponibles.length === 0) return;
    if (!metodosPagoDisponibles.some((m) => m.valor === metodoPago)) {
      setMetodoPago(metodosPagoDisponibles[0].valor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metodosPagoDisponibles]);

  const [pedidosPendientes, setPedidosPendientes] = useState<Pedido[]>([]);
  const [modalPendientesAbierto, setModalPendientesAbierto] = useState(false);
  const [anulando, setAnulando] = useState<string | null>(null);
  const [errorAnular, setErrorAnular] = useState<string | null>(null);

  function cargarPendientes() {
    apiFetch<Pedido[]>("/pedidos?estado=pendientes", token).then(setPedidosPendientes);
  }

  async function anular(pedido: Pedido) {
    if (!confirm(`¿Anular el ticket #${pedido.folio}? Esto no se puede deshacer.`)) return;
    setAnulando(pedido.id);
    setErrorAnular(null);
    try {
      await apiFetch(`/pedidos/${pedido.folio}/cancelar`, token, { method: "PATCH" });
      cargarPendientes();
    } catch (err) {
      setErrorAnular(err instanceof ApiError ? err.message : "No se pudo anular el pedido");
    } finally {
      setAnulando(null);
    }
  }

  useEffect(() => {
    apiFetch<{ productos: Producto[]; extras: Extra[] }>("/menu", token).then((data) => {
      setProductos(data.productos);
      setExtras(data.extras);
    });
    cargarPendientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!socket) return;
    // Cualquiera de estos eventos puede sacar o meter un pedido de la lista de
    // "pendientes" (ej. cocina/parrilla lo terminan, o se anula desde otra caja).
    const onCambio = () => cargarPendientes();
    socket.on(SOCKET_EVENTS.PEDIDO_NUEVO, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_ACTUALIZADO, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_CANCELADO, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_COCINA_LISTA, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_PARRILLA_LISTA, onCambio);
    socket.on(SOCKET_EVENTS.PEDIDO_COMPLETADO, onCambio);
    return () => {
      socket.off(SOCKET_EVENTS.PEDIDO_NUEVO, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_ACTUALIZADO, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_CANCELADO, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_COCINA_LISTA, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_PARRILLA_LISTA, onCambio);
      socket.off(SOCKET_EVENTS.PEDIDO_COMPLETADO, onCambio);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

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

  const categorias = useMemo(() => {
    const grupos = new Map<string, Producto[]>();
    for (const producto of productos) {
      const lista = grupos.get(producto.categoria) ?? [];
      lista.push(producto);
      grupos.set(producto.categoria, lista);
    }
    // Platos primero, Bebidas después — se piden muchos más platos, así que
    // esa pestaña debe ser la que aparece de entrada. Cualquier otra
    // categoría que el admin cargue va después, en el orden en que aparece.
    return [...grupos.entries()].sort((a, b) => (ORDEN_CATEGORIA[a[0]] ?? 99) - (ORDEN_CATEGORIA[b[0]] ?? 99));
  }, [productos]);

  // Pestañas: una por categoría de producto (Platos, Bebidas, etc., según lo
  // que cargue el admin) + "Extras" al final — separadas para no mezclar todo
  // en una sola lista larga.
  const [tabActiva, setTabActiva] = useState<string | null>(null);
  const tabs = useMemo(() => [...categorias.map(([categoria]) => categoria), "Extras"], [categorias]);
  const tabEfectiva = tabActiva && tabs.includes(tabActiva) ? tabActiva : (tabs[0] ?? "");
  const productosDeLaTab = categorias.find(([categoria]) => categoria === tabEfectiva)?.[1] ?? [];

  // Un extra siempre va pegado a un plato (ItemPedidoExtra cuelga de un
  // ItemPedido en la base) — como ahora se tocan desde su propia pestaña y no
  // desde la línea del carrito, se le suma al último plato que se agregó (el
  // que la cajera está armando en este momento).
  function agregarExtraAUltimaLinea(extra: Extra) {
    const ultimaLinea = carrito[carrito.length - 1];
    if (!ultimaLinea) {
      setError("Agregá un plato antes de sumarle un extra.");
      return;
    }
    toggleExtra(ultimaLinea.lineaId, extra.id);
  }

  /** Se llama al confirmar en el modal de resumen ("Sí, cobrar") — recién ahí
   * se manda a cobrar (o se abre el QR si corresponde), nunca de un solo toque
   * en el botón principal, para no cobrar por accidente. */
  function continuarPago() {
    setMostrandoConfirmacion(false);
    if (metodoPago === "QR") {
      setMostrandoQr(true);
    } else {
      cobrar();
    }
  }

  async function cobrar() {
    if (carrito.length === 0) return;
    if (tipoConsumo === "LOCAL" && configuracion.mesaHabilitada && !mesa.trim()) {
      setError("Indicá el número de mesa antes de cobrar.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const pedido = await apiFetch<Pedido>("/pedidos", token, {
        method: "POST",
        body: JSON.stringify({
          clienteNombre: clienteNombre.trim() || undefined,
          clienteCarnet: clienteCarnet.trim() || undefined,
          tipoConsumo,
          mesa: tipoConsumo === "LOCAL" && configuracion.mesaHabilitada ? mesa.trim() : undefined,
          metodoPago,
          items: carrito.map((linea) => ({
            productoId: linea.productoId,
            cantidad: linea.cantidad,
            extraIds: linea.extraIds,
          })),
        }),
      });
      setMostrandoQr(false);
      setUltimoTicket(pedido);
      setCarrito([]);
      setClienteNombreInput("");
      setClienteCarnetInput("");
      setTipoConsumo("LOCAL");
      setMesa("");
      setMetodoPago("EFECTIVO");
    } catch (err) {
      // Si falla estando en el modal de QR, se queda abierto para que la
      // cajera vea el error ahí mismo y pueda reintentar sin volver a abrirlo.
      setError(err instanceof Error ? err.message : "No se pudo registrar el pedido");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="caja-root min-h-dvh bg-neutral-100">
      {/* Todo el resto de la pantalla de Caja (menú, carrito, botones) va acá
          adentro, oculto al imprimir — cuando se abre el ticket y se manda a
          imprimir, lo único que tiene que salir en la hoja es el ticket, no
          la interfaz de venta completa detrás. */}
      <div className="no-imprimir">
      <EstacionHeader titulo="Caja" />

      <div className="flex justify-end px-3 pt-3 sm:px-4">
        <button
          onClick={() => setModalPendientesAbierto(true)}
          className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-neutral-700 shadow-sm"
        >
          <IconPedidos width={14} height={14} />
          Pedidos pendientes
          {pedidosPendientes.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1 text-[11px] font-semibold text-white">
              {pedidosPendientes.length}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 p-3 pb-24 sm:p-4 lg:grid-cols-[1fr_380px] lg:pb-4">
        {/* Menú */}
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tabNombre) => (
              <button
                key={tabNombre}
                onClick={() => setTabActiva(tabNombre)}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${
                  tabEfectiva === tabNombre ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {tabNombre}
              </button>
            ))}
          </div>

          {/* auto-rows-fr: todas las tarjetas de la misma fila quedan con la
              misma altura sin importar si el nombre ocupa una o dos líneas —
              así el cuadrito y la imagen se ven siempre del mismo tamaño. */}
          {tabEfectiva === "Extras" ? (
            <div className="grid grid-cols-2 gap-2 auto-rows-fr sm:grid-cols-3 md:grid-cols-4">
              {carrito.length === 0 && (
                <p className="col-span-full text-sm text-neutral-500">Agregá un plato primero — el extra se suma al último que toques.</p>
              )}
              {extras.map((extra) => {
                const ultimaLinea = carrito[carrito.length - 1];
                const yaAgregado = !!ultimaLinea?.extraIds.includes(extra.id);
                return (
                  <button
                    key={extra.id}
                    onClick={() => agregarExtraAUltimaLinea(extra)}
                    title={
                      ultimaLinea
                        ? `${yaAgregado ? "Quitar de" : "Agregar a"} "${ultimaLinea.nombre}"`
                        : "Agregá un plato primero"
                    }
                    className={`relative flex h-full flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm active:scale-[0.98] ${
                      yaAgregado ? "border-emerald-500 ring-2 ring-emerald-200" : "border-neutral-200"
                    }`}
                  >
                    <span
                      className={`absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-white shadow ${
                        yaAgregado ? "bg-emerald-600" : "bg-neutral-900"
                      }`}
                    >
                      {yaAgregado ? <IconCheck width={14} height={14} /> : <IconPlus width={14} height={14} />}
                    </span>
                    <ImagenProducto imagenUrl={extra.imagenUrl} nombre={extra.nombre} className="h-24 w-full shrink-0" />
                    <div className="flex flex-1 flex-col justify-center p-3">
                      <p className="line-clamp-2 text-lg font-bold leading-tight text-neutral-900">{extra.nombre}</p>
                      <p className="mt-1 text-lg font-bold text-emerald-700">+Bs {formatBs(extra.precio)}</p>
                    </div>
                  </button>
                );
              })}
              {extras.length === 0 && <p className="col-span-full text-sm text-neutral-500">No hay extras cargados.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 auto-rows-fr sm:grid-cols-3 md:grid-cols-4">
              {productosDeLaTab.map((producto) => (
                <button
                  key={producto.id}
                  onClick={() => agregarProducto(producto)}
                  className="relative flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-left shadow-sm active:scale-[0.98] active:bg-neutral-50"
                >
                  <span className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-white shadow">
                    <IconPlus width={14} height={14} />
                  </span>
                  <ImagenProducto
                    imagenUrl={producto.imagenUrl}
                    nombre={producto.nombre}
                    categoria={producto.categoria}
                    className="h-24 w-full shrink-0"
                  />
                  <div className="flex flex-1 flex-col justify-center p-3">
                    <p className="line-clamp-2 text-lg font-bold leading-tight text-neutral-900">{producto.nombre}</p>
                    <p className="mt-1 text-lg font-bold text-emerald-700">Bs {formatBs(producto.precio)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {productos.length === 0 && (
            <p className="text-sm text-neutral-500">Cargando menú…</p>
          )}
        </div>

        {/* Carrito / cobro */}
        <div
          id="pedido-actual"
          className="scroll-mt-4 space-y-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3 shadow-sm sm:p-4 lg:sticky lg:top-4 lg:h-fit"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
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
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-red-600 active:bg-red-50"
                  >
                    <IconTrash width={18} height={18} />
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
                  <span className="ml-auto text-lg font-bold text-neutral-900">
                    Bs {formatBs(linea.precioUnitario * linea.cantidad)}
                  </span>
                </div>

                {linea.extraIds.length > 0 && (
                  // Mismo look que un ítem principal (nombre igual de grande,
                  // precio igual de grande, mismo botón Quitar) — la única
                  // diferencia es la etiqueta "(extra)" para que la cajera
                  // distinga de un vistazo que va pegado al plato de arriba.
                  <ul className="mt-2 space-y-2 border-t border-dashed border-neutral-300 pt-2">
                    {linea.extraIds.map((extraId) => {
                      const extra = extras.find((e) => e.id === extraId);
                      if (!extra) return null;
                      return (
                        <li key={extraId}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-neutral-900">
                              {extra.nombre} <span className="font-normal text-neutral-500">(extra)</span>
                            </p>
                            <button
                              onClick={() => toggleExtra(linea.lineaId, extraId)}
                              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-red-600 active:bg-red-50"
                            >
                              <IconTrash width={18} height={18} />
                              Quitar
                            </button>
                          </div>
                          <p className="mt-1 text-right text-lg font-bold text-neutral-900">Bs {formatBs(extra.precio)}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          <div className="border-t border-neutral-200 pt-3">
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Cliente (opcional)
            </label>
            {/* Texto libre, no un registro formal — Caja solo necesita algo
                para llamar al cliente y que salga en el ticket, sin tener que
                buscarlo ni crearlo en la base de clientes. */}
            <IconInput
              icon={IconUser}
              className="mb-2"
              placeholder="Nombre del cliente"
              value={clienteNombre}
              onChange={(e) => setClienteNombreInput(e.target.value)}
            />
            <IconInput
              icon={IconIdCard}
              className="mb-3"
              placeholder="CI / Carnet (opcional)"
              value={clienteCarnet}
              onChange={(e) => setClienteCarnetInput(e.target.value)}
            />

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

            {tipoConsumo === "LOCAL" && configuracion.mesaHabilitada && (
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
            <div
              className="mb-3 grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${metodosPagoDisponibles.length || 1}, minmax(0,1fr))` }}
            >
              {metodosPagoDisponibles.map(({ valor, etiqueta }) => (
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
              <span>Bs {formatBs(total)}</span>
            </div>

            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <button
              onClick={() => setMostrandoConfirmacion(true)}
              disabled={
                carrito.length === 0 || enviando || (tipoConsumo === "LOCAL" && configuracion.mesaHabilitada && !mesa.trim())
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
            >
              <IconCheck width={18} height={18} />
              {enviando ? "Registrando…" : metodoPago === "QR" ? "Mostrar QR y cobrar" : "Marcar como pagado"}
            </button>
          </div>
        </div>
      </div>

      {/* Barra fija de "lo que se está agregando" — en celular el carrito queda
          debajo del menú y hay que bajar para verlo; esta barra siempre visible
          muestra cuántos platos y cuánto se lleva sin necesidad de scrollear,
          y toca para saltar directo al pedido. En desktop no hace falta: el
          carrito ya está siempre a la vista al costado (lg:sticky). */}
      {carrito.length > 0 && (() => {
        const cantidadItems = carrito.reduce((s, l) => s + l.cantidad, 0);
        return (
          <button
            onClick={() => document.getElementById("pedido-actual")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 bg-neutral-900 px-4 py-3 text-white shadow-[0_-2px_10px_rgba(0,0,0,0.15)] lg:hidden"
          >
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
                <IconBag width={16} height={16} />
              </span>
              <span className="text-sm font-semibold">
                {cantidadItems} plato{cantidadItems === 1 ? "" : "s"} agregado{cantidadItems === 1 ? "" : "s"}
              </span>
            </span>
            <span className="flex items-center gap-2 text-base font-bold">
              Bs {formatBs(total)}
              <span className="text-xs font-medium text-neutral-300">Ver pedido ▲</span>
            </span>
          </button>
        );
      })()}
      </div>

      {mostrandoConfirmacion && (
        <Modal titulo="Confirmar pedido" onCerrar={() => setMostrandoConfirmacion(false)}>
          <ul className="mb-3 space-y-2 text-sm">
            {carrito.map((linea) => (
              <li key={linea.lineaId}>
                <div className="flex justify-between">
                  <span className="font-medium text-neutral-900">
                    {linea.cantidad}x {linea.nombre}
                  </span>
                  <span className="font-medium text-neutral-900">
                    Bs {formatBs(linea.precioUnitario * linea.cantidad)}
                  </span>
                </div>
                {linea.extraIds.map((extraId) => {
                  const extra = extras.find((e) => e.id === extraId);
                  if (!extra) return null;
                  return (
                    <div key={extraId} className="flex justify-between pl-4 text-xs text-neutral-500">
                      <span>+ {extra.nombre} (extra)</span>
                      <span>Bs {formatBs(extra.precio)}</span>
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>

          <div className="space-y-1 border-t border-neutral-200 pt-2 text-sm text-neutral-600">
            <p>
              {tipoConsumo === "LOCAL"
                ? configuracion.mesaHabilitada
                  ? `Mesa ${mesa || "?"}`
                  : "En el local"
                : "Para llevar"}
              {clienteNombre.trim() ? ` · ${clienteNombre.trim()}` : ""}
            </p>
            <p>Método de pago: {METODOS_PAGO.find((m) => m.valor === metodoPago)?.etiqueta}</p>
          </div>

          <div className="mb-4 mt-2 flex justify-between border-t border-neutral-200 pt-2 text-lg font-bold text-neutral-900">
            <span>Total</span>
            <span>Bs {formatBs(total)}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setMostrandoConfirmacion(false)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-3 text-base font-semibold text-white active:bg-red-700"
            >
              No
            </button>
            <button
              onClick={continuarPago}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white active:bg-emerald-700"
            >
              <IconCheck width={18} height={18} />
              Sí
            </button>
          </div>
        </Modal>
      )}

      {mostrandoQr && (
        <QrPagoModal
          qrUrl={configuracion.qrPagoUrl}
          nombreNegocio={configuracion.nombreNegocio}
          total={total}
          enviando={enviando}
          error={error}
          onCancelar={() => setMostrandoQr(false)}
          onConfirmar={cobrar}
        />
      )}

      {ultimoTicket && <TicketModal pedido={ultimoTicket} onCerrar={() => setUltimoTicket(null)} />}
      {modalPendientesAbierto && (
        <Modal titulo="Pedidos pendientes" onCerrar={() => setModalPendientesAbierto(false)}>
          {errorAnular && <p className="mb-2 text-sm text-red-600">{errorAnular}</p>}
          {pedidosPendientes.length === 0 ? (
            <p className="text-sm text-neutral-400">No hay pedidos pendientes en este momento.</p>
          ) : (
            <ul className="space-y-3">
              {pedidosPendientes.map((pedido) => (
                <li key={pedido.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-bold text-neutral-900">Ticket #{pedido.folio}</span>
                    <span className="font-semibold text-neutral-900">Bs {formatBs(pedido.total)}</span>
                  </div>
                  <p className="mb-2 text-xs text-neutral-500">
                    {pedido.tipoConsumo === "LOCAL"
                      ? configuracion.mesaHabilitada
                        ? `Mesa ${pedido.mesa ?? "?"}`
                        : "En el local"
                      : "Para llevar"}
                    {pedido.clienteNombre ? ` · ${pedido.clienteNombre}` : ""}
                  </p>
                  {puedeModificarse(pedido) ? (
                    <button
                      onClick={() => anular(pedido)}
                      disabled={anulando === pedido.id}
                      className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 disabled:opacity-50"
                    >
                      <IconTrash width={14} height={14} />
                      {anulando === pedido.id ? "Anulando…" : "Anular"}
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-neutral-400">
                      <IconCheck width={14} height={14} />
                      Ya en preparación — no se puede anular
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}

/** Pantalla completa para que el cliente escanee el QR de cobro — el QR lo
 * carga el admin desde Configuración. No es un cobro verificado automático:
 * el cajero confirma a mano una vez que ve que el pago le llegó. */
function QrPagoModal({
  qrUrl,
  nombreNegocio,
  total,
  enviando,
  error,
  onCancelar,
  onConfirmar,
}: {
  qrUrl: string | null;
  nombreNegocio: string;
  total: number;
  enviando: boolean;
  error: string | null;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-950 p-6 text-white">
      <p className="text-sm font-semibold uppercase tracking-wide text-neutral-400">{nombreNegocio}</p>
      <p className="mt-1 text-3xl font-bold">Bs {formatBs(total)}</p>
      <p className="mb-6 text-sm text-neutral-400">Escaneá el código para pagar</p>

      <div className="flex w-full max-w-xs flex-1 items-center justify-center">
        {qrUrl ? (
          <img src={qrUrl} alt="Código QR de pago" className="aspect-square w-full rounded-2xl bg-white p-4" />
        ) : (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-700 p-4 text-center">
            <p className="text-sm text-neutral-400">
              Todavía no hay un código QR cargado. El administrador puede subirlo desde Configuración.
            </p>
          </div>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
        <button
          onClick={onConfirmar}
          disabled={enviando}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
        >
          <IconCheck width={18} height={18} />
          {enviando ? "Registrando…" : "Ya pagó — Confirmar cobro"}
        </button>
        <button
          onClick={onCancelar}
          disabled={enviando}
          className="rounded-lg bg-neutral-800 px-4 py-3 text-sm font-medium text-neutral-300 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
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
    <div className="ticket-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="ticket-imprimible w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-lg sm:rounded-2xl">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {configuracion.nombreNegocio}
        </p>
        <h2 className="mb-1 text-lg font-bold">Ticket #{pedido.folio}</h2>
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
                  <span>+ {extra.nombre}</span>
                  <span>Bs {formatBs(extra.precio)}</span>
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
