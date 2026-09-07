import { useEffect, useMemo, useState } from "react";
import type { ReporteGanancias } from "shared";
import { SOCKET_EVENTS } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch } from "../../lib/api";
import { useSocket } from "../../lib/socketContext";
import { IconBag, IconGanancias, IconHome, IconPedidos } from "../../components/icons";
import { StatCard } from "../../components/StatCard";
import { TablaSeccion, Th, FilaVacia, FiltroBusqueda } from "../../components/TablaSeccion";

const bs = (v: number) => `Bs ${v.toFixed(2)}`;

export function AdminGananciasPage() {
  const { token } = useAuth();
  const socket = useSocket();
  const [reporte, setReporte] = useState<ReporteGanancias | null>(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    apiFetch<ReporteGanancias>("/reportes/ganancias", token).then(setReporte);
  }, [token]);

  useEffect(() => {
    if (!socket) return;
    const onVenta = (r: ReporteGanancias) => setReporte(r);
    socket.on(SOCKET_EVENTS.VENTA_REGISTRADA, onVenta);
    return () => {
      socket.off(SOCKET_EVENTS.VENTA_REGISTRADA, onVenta);
    };
  }, [socket]);

  const totalProductos = reporte?.porProducto.reduce((s, p) => s + p.total, 0) ?? 0;
  const ticketPromedio = reporte && reporte.cantidadPedidos > 0 ? reporte.totalVendido / reporte.cantidadPedidos : 0;

  const filasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    const filas = reporte?.porProducto ?? [];
    if (!termino) return filas;
    return filas.filter((p) => p.nombre.toLowerCase().includes(termino));
  }, [reporte, busqueda]);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Ganancias de hoy</h1>
        <p className="text-xs text-neutral-500">Se actualiza solo, en vivo, cada vez que se completa una venta.</p>
      </div>

      {reporte ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <StatCard
              icono={IconGanancias}
              acento="esmeralda"
              label="Total vendido hoy"
              value={bs(reporte.totalVendido)}
              hint="Suma de todos los pedidos ya completados hoy (cocina y parrilla terminaron), aunque todavía no se hayan entregado."
            />
            <StatCard
              icono={IconPedidos}
              acento="azul"
              label="Pedidos completados"
              value={String(reporte.cantidadPedidos)}
              hint="Cantidad de tickets distintos vendidos hoy."
            />
            <StatCard
              icono={IconHome}
              acento="ambar"
              label="Ticket promedio"
              value={bs(ticketPromedio)}
              hint="Total vendido dividido entre la cantidad de pedidos — cuánto gasta en promedio cada cliente."
            />
            <StatCard
              icono={IconBag}
              acento="violeta"
              label="En local / para llevar"
              value={`${bs(reporte.porTipoConsumo.LOCAL)} / ${bs(reporte.porTipoConsumo.LLEVAR)}`}
              hint="Cuánto de lo vendido hoy fue para comer en el local vs. para llevar."
            />
          </div>

          <TablaSeccion
            icono={IconGanancias}
            acento="esmeralda"
            titulo="Ventas por producto"
            descripcion="Qué se vendió hoy, cuánto y qué tanto pesa cada plato en el total del día."
            filtros={<FiltroBusqueda value={busqueda} onChange={setBusqueda} placeholder="Buscar producto…" />}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <Th hint="Nombre del plato o bebida vendido hoy.">Producto</Th>
                    <Th align="right" hint="Unidades vendidas hoy de este producto (sumando todos los pedidos).">
                      Cantidad
                    </Th>
                    <Th align="right" hint="Precio promedio cobrado por unidad hoy, incluyendo extras.">
                      Precio prom.
                    </Th>
                    <Th align="right" hint="Total vendido de este producto hoy (precio × cantidad + extras).">
                      Total vendido
                    </Th>
                    <Th align="right" hint="Qué porcentaje del total vendido hoy representa este producto — para ver de un vistazo qué mueve más la caja.">
                      % del total
                    </Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filasFiltradas.map((p) => {
                    const pct = totalProductos > 0 ? (p.total / totalProductos) * 100 : 0;
                    return (
                      <tr key={p.productoId} className="hover:bg-neutral-50">
                        <td className="px-3 py-2.5 font-medium text-neutral-900">{p.nombre}</td>
                        <td className="px-3 py-2.5 text-right text-neutral-700">{p.cantidad}</td>
                        <td className="px-3 py-2.5 text-right text-neutral-500">{bs(p.total / p.cantidad)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-neutral-900">{bs(p.total)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-100">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="w-10 text-neutral-500">{pct.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filasFiltradas.length === 0 && (
                    <FilaVacia colSpan={5}>
                      {reporte.porProducto.length === 0 ? "Todavía no se vendió nada hoy." : "Ningún producto coincide con la búsqueda."}
                    </FilaVacia>
                  )}
                </tbody>
              </table>
            </div>
          </TablaSeccion>
        </>
      ) : (
        <p className="text-sm text-neutral-400">Cargando…</p>
      )}
    </div>
  );
}
