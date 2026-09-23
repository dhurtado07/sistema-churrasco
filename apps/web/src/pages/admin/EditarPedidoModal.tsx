import { useEffect, useMemo, useState } from "react";
import type { Cliente, Pedido, Producto, TipoConsumo } from "shared";
import { apiFetch, ApiError } from "../../lib/api";
import { itemsPedidoACarrito, useCarrito } from "../../lib/useCarrito";
import { useMenu } from "../../lib/menuContext";
import { formatBs } from "../../lib/format";
import { useConfiguracion } from "../../lib/configuracionContext";
import { IconInput } from "../../components/IconInput";
import { ClienteModal } from "./AdminClientesPage";
import {
  IconBag,
  IconCheck,
  IconClose,
  IconHome,
  IconIdCard,
  IconMesa,
  IconMinus,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUser,
} from "../../components/icons";

export function EditarPedidoModal({
  pedido,
  token,
  onCerrar,
  onGuardado,
}: {
  pedido: Pedido;
  token: string | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { productos, extras } = useMenu();
  const { configuracion } = useConfiguracion();
  const { carrito, agregarProducto, cambiarCantidad, cambiarCantidadExtra, quitarLinea, total } = useCarrito(
    extras,
    itemsPedidoACarrito(pedido.items),
  );
  const [tipoConsumo, setTipoConsumo] = useState<TipoConsumo>(pedido.tipoConsumo);
  const [mesa, setMesa] = useState(pedido.mesa ?? "");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(
    pedido.clienteId
      ? {
          id: pedido.clienteId,
          nombre: pedido.clienteNombre ?? "",
          carnet: pedido.clienteCarnet ?? "",
          creadoEn: pedido.creadoEn,
        }
      : null,
  );
  // La inmensa mayoría de los pedidos se cobran en Caja con nombre libre, sin
  // un Cliente del directorio (clienteId null) — si acá solo se pudiera
  // guardar con un cliente del directorio, editar cualquiera de esos pedidos
  // quedaría bloqueado. Estos campos preservan/editan ese texto libre; elegir
  // un cliente del directorio (arriba) tiene prioridad si se usa.
  const [clienteNombreLibre, setClienteNombreLibre] = useState(pedido.clienteNombre ?? "");
  const [clienteCarnetLibre, setClienteCarnetLibre] = useState(pedido.clienteCarnet ?? "");
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [resultadosCliente, setResultadosCliente] = useState<Cliente[]>([]);
  const [modalClienteAbierto, setModalClienteAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const categorias = useMemo(() => {
    const grupos = new Map<string, Producto[]>();
    for (const producto of productos) {
      const lista = grupos.get(producto.categoria) ?? [];
      lista.push(producto);
      grupos.set(producto.categoria, lista);
    }
    return [...grupos.entries()];
  }, [productos]);

  function seleccionarCliente(cliente: Cliente) {
    setClienteSeleccionado(cliente);
    setBusquedaCliente("");
    setResultadosCliente([]);
  }

  async function guardar() {
    if (carrito.length === 0) return;
    if (!clienteSeleccionado && !clienteNombreLibre.trim()) {
      setError("Indicá el nombre del cliente antes de guardar.");
      return;
    }
    if (tipoConsumo === "LOCAL" && !mesa.trim()) {
      setError("Indicá el número de mesa antes de guardar.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await apiFetch(`/pedidos/${pedido.folio}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          clienteId: clienteSeleccionado?.id,
          clienteNombre: clienteSeleccionado?.nombre ?? clienteNombreLibre.trim(),
          clienteCarnet: clienteSeleccionado?.carnet ?? (configuracion.ciHabilitado ? clienteCarnetLibre.trim() || undefined : undefined),
          tipoConsumo,
          mesa: tipoConsumo === "LOCAL" ? mesa.trim() : undefined,
          items: carrito.map((linea) => ({
            productoId: linea.productoId,
            cantidad: linea.cantidad,
            extras: linea.extras,
          })),
        }),
      });
      onGuardado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el pedido");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-lg sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="text-lg font-bold text-neutral-900">Editar ticket #{pedido.numeroTicket}</h2>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto p-4 sm:grid-cols-[1fr_320px]">
          {/* Menú para agregar más platos */}
          <div className="space-y-4">
            {categorias.map(([categoria, items]) => (
              <section key={categoria}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {categoria}
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {items.map((producto) => (
                    <button
                      key={producto.id}
                      onClick={() => agregarProducto(producto)}
                      className="relative overflow-hidden rounded-xl bg-neutral-50 p-2.5 text-left"
                    >
                      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white">
                        <IconPlus width={11} height={11} />
                      </span>
                      <p className="text-sm font-medium text-neutral-900">{producto.nombre}</p>
                      <p className="text-xs text-neutral-500">Bs {formatBs(producto.precio)}</p>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Carrito editable */}
          <div className="space-y-3">
            <ul className="space-y-2">
              {carrito.map((linea) => (
                <li key={linea.lineaId} className="rounded-lg border border-neutral-200 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-neutral-900">{linea.nombre}</p>
                    <button
                      onClick={() => quitarLinea(linea.lineaId)}
                      className="flex items-center gap-1 text-xs text-red-600"
                    >
                      <IconTrash width={13} height={13} />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      onClick={() => cambiarCantidad(linea.lineaId, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200"
                    >
                      <IconMinus width={14} height={14} />
                    </button>
                    <span className="w-5 text-center text-sm">{linea.cantidad}</span>
                    <button
                      onClick={() => cambiarCantidad(linea.lineaId, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200"
                    >
                      <IconPlus width={14} height={14} />
                    </button>
                    <span className="ml-auto text-xs text-neutral-500">
                      Bs{" "}
                      {formatBs(
                        (linea.precioUnitario +
                          linea.extras.reduce((s, sel) => {
                            const extra = extras.find((e) => e.id === sel.extraId);
                            return s + (extra?.precio ?? 0) * sel.cantidad;
                          }, 0)) *
                          linea.cantidad,
                      )}
                    </span>
                  </div>
                  {extras.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {extras.map((extra) => {
                        const seleccion = linea.extras.find((e) => e.extraId === extra.id);
                        if (!seleccion) {
                          return (
                            <button
                              key={extra.id}
                              type="button"
                              onClick={() => cambiarCantidadExtra(linea.lineaId, extra.id, 1)}
                              className="flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-0.5 text-[11px]"
                            >
                              <IconPlus width={10} height={10} />
                              {extra.nombre}
                            </button>
                          );
                        }
                        return (
                          <span
                            key={extra.id}
                            className="flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[11px]"
                          >
                            <button
                              type="button"
                              onClick={() => cambiarCantidadExtra(linea.lineaId, extra.id, -1)}
                              className="flex h-4 w-4 items-center justify-center rounded-full bg-white"
                            >
                              <IconMinus width={9} height={9} />
                            </button>
                            {seleccion.cantidad}x {extra.nombre}
                            <button
                              type="button"
                              onClick={() => cambiarCantidadExtra(linea.lineaId, extra.id, 1)}
                              className="flex h-4 w-4 items-center justify-center rounded-full bg-white"
                            >
                              <IconPlus width={9} height={9} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
              {carrito.length === 0 && (
                <p className="text-sm text-neutral-400">Agregá al menos un plato del menú.</p>
              )}
            </ul>

            <div className="border-t border-neutral-200 pt-3">
              <label className="mb-1 block text-xs font-medium text-neutral-600">Cliente</label>
              {clienteSeleccionado ? (
                <div className="mb-2 flex items-center justify-between rounded-lg border border-neutral-300 px-3 py-2 text-sm">
                  <span className="font-medium">{clienteSeleccionado.nombre}</span>
                  <button
                    type="button"
                    onClick={() => setClienteSeleccionado(null)}
                    className="flex items-center gap-1 text-xs text-red-600"
                  >
                    <IconTrash width={13} height={13} />
                  </button>
                </div>
              ) : (
                <div className="relative mb-2">
                  <div className="flex gap-2">
                    <IconInput
                      icon={IconSearch}
                      placeholder="Buscar cliente…"
                      value={busquedaCliente}
                      onChange={(e) => setBusquedaCliente(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setModalClienteAbierto(true)}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium"
                    >
                      <IconPlus width={13} height={13} />
                    </button>
                  </div>
                  {resultadosCliente.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-md">
                      {resultadosCliente.map((cliente) => (
                        <li key={cliente.id}>
                          <button
                            type="button"
                            onClick={() => seleccionarCliente(cliente)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50"
                          >
                            <IconUser width={13} height={13} className="text-neutral-400" />
                            {cliente.nombre}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* La mayoría de los pedidos no tienen un cliente del
                      directorio (se cobraron con nombre libre en Caja) — sin
                      esto no habría forma de guardar el nombre que ya tenían,
                      ni de cumplir con que el nombre es obligatorio. */}
                  <IconInput
                    icon={IconUser}
                    className="mt-2"
                    placeholder="Nombre del cliente"
                    value={clienteNombreLibre}
                    onChange={(e) => setClienteNombreLibre(e.target.value)}
                  />
                  {configuracion.ciHabilitado && (
                    <IconInput
                      icon={IconIdCard}
                      className="mt-2"
                      placeholder="CI / Carnet (opcional)"
                      value={clienteCarnetLibre}
                      onChange={(e) => setClienteCarnetLibre(e.target.value)}
                    />
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
                      className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${
                        tipoConsumo === opcion ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      <Icon width={14} height={14} />
                      {opcion === "LOCAL" ? "En local" : "Para llevar"}
                    </button>
                  );
                })}
              </div>

              {tipoConsumo === "LOCAL" && (
                <IconInput
                  icon={IconMesa}
                  placeholder="Número de mesa"
                  value={mesa}
                  onChange={(e) => setMesa(e.target.value)}
                />
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-neutral-200 p-4">
          <div className="mb-3 flex items-center justify-between text-lg font-bold">
            <span>Total</span>
            <span>Bs {formatBs(total)}</span>
          </div>
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <button
            onClick={guardar}
            disabled={
              carrito.length === 0 ||
              guardando ||
              (!clienteSeleccionado && !clienteNombreLibre.trim()) ||
              (tipoConsumo === "LOCAL" && !mesa.trim())
            }
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            <IconCheck width={16} height={16} />
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

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
