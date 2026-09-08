import { useEffect, useMemo, useState } from "react";
import type { ReporteGanancias } from "shared";
import { SOCKET_EVENTS } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch } from "../../lib/api";
import { useSocket } from "../../lib/socketContext";
import { formatBs } from "../../lib/format";
import { IconBag, IconGanancias, IconHome, IconPedidos } from "../../components/icons";
import { StatCard } from "../../components/StatCard";
import { TablaSeccion, FiltroBusqueda, FiltroChip, Th, FilaVacia, Paginacion } from "../../components/TablaSeccion";

const bs = (v: number) => `Bs ${formatBs(v)}`;

type Preset = "hoy" | "semana" | "mes" | "manual";

function hoyStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function rangoDePreset(preset: Exclude<Preset, "manual">): { desde: string; hasta: string } {
  const hasta = hoyStr();
  if (preset === "hoy") return { desde: hasta, hasta };
  const inicio = new Date();
  if (preset === "semana") inicio.setDate(inicio.getDate() - 6);
  else inicio.setDate(1);
  return { desde: inicio.toISOString().slice(0, 10), hasta };
}

function formatoFechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

export function AdminGananciasPage() {
  const { token } = useAuth();
  const socket = useSocket();
  const [reporte, setReporte] = useState<ReporteGanancias | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [preset, setPreset] = useState<Preset>("hoy");
  const [desde, setDesde] = useState(hoyStr());
  const [hasta, setHasta] = useState(hoyStr());
  const [pagina, setPagina] = useState(1);
  const [tamanoPagina, setTamanoPagina] = useState(50);

  const esHoy = desde === hoyStr() && hasta === hoyStr();

  function aplicarPreset(p: Exclude<Preset, "manual">) {
    setPreset(p);
    const r = rangoDePreset(p);
    setDesde(r.desde);
    setHasta(r.hasta);
  }

  useEffect(() => {
    apiFetch<ReporteGanancias>(`/reportes/ganancias?desde=${desde}&hasta=${hasta}`, token).then(setReporte);
  }, [token, desde, hasta]);

  useEffect(() => {
    if (!socket) return;
    // Las actualizaciones en vivo solo aplican si se está viendo el día de hoy;
    // si el usuario eligió otra fecha/rango, una venta nueva no debe pisar lo que está mirando.
    const onVenta = (r: ReporteGanancias) => {
      if (esHoy) setReporte(r);
    };
    socket.on(SOCKET_EVENTS.VENTA_REGISTRADA, onVenta);
    return () => {
      socket.off(SOCKET_EVENTS.VENTA_REGISTRADA, onVenta);
    };
  }, [socket, esHoy]);

  const ticketPromedio = reporte && reporte.cantidadPedidos > 0 ? reporte.totalVendido / reporte.cantidadPedidos : 0;

  const filasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    const filas = reporte?.porProducto ?? [];
    if (!termino) return filas;
    return filas.filter((p) => p.nombre.toLowerCase().includes(termino));
  }, [reporte, busqueda]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, reporte, tamanoPagina]);

  const totalPaginas = Math.max(1, Math.ceil(filasFiltradas.length / tamanoPagina));
  const filasPagina = useMemo(() => {
    const inicio = (pagina - 1) * tamanoPagina;
    return filasFiltradas.slice(inicio, inicio + tamanoPagina);
  }, [filasFiltradas, pagina, tamanoPagina]);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">{esHoy ? "Ganancias de hoy" : "Ganancias"}</h1>
        <p className="text-xs text-neutral-500">
          {esHoy
            ? "Se actualiza solo, en vivo, cada vez que se completa una venta."
            : `Del ${formatoFechaCorta(desde)} al ${formatoFechaCorta(hasta)}.`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["hoy", "semana", "mes"] as const).map((p) => (
          <FiltroChip key={p} activo={preset === p} acento="esmeralda" onClick={() => aplicarPreset(p)}>
            {p === "hoy" ? "Hoy" : p === "semana" ? "Esta semana" : "Este mes"}
          </FiltroChip>
        ))}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={desde}
            max={hasta}
            onChange={(e) => {
              setDesde(e.target.value);
              setPreset("manual");
            }}
            className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
          />
          <span className="text-xs text-neutral-400">a</span>
          <input
            type="date"
            value={hasta}
            min={desde}
            max={hoyStr()}
            onChange={(e) => {
              setHasta(e.target.value);
              setPreset("manual");
            }}
            className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
          />
        </div>
      </div>

      {reporte ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <StatCard
              icono={IconGanancias}
              acento="esmeralda"
              label={esHoy ? "Total vendido hoy" : "Total vendido"}
              value={bs(reporte.totalVendido)}
              hint="Suma de todos los pedidos ya completados en el período (cocina y parrilla terminaron), aunque todavía no se hayan entregado."
            />
            <StatCard
              icono={IconPedidos}
              acento="azul"
              label="Pedidos completados"
              value={String(reporte.cantidadPedidos)}
              hint="Cantidad de tickets distintos vendidos en el período."
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
              hint="Cuánto de lo vendido en el período fue para comer en el local vs. para llevar."
            />
          </div>

          <TablaSeccion
            icono={IconGanancias}
            acento="esmeralda"
            titulo="Ventas por producto"
            descripcion="Qué se vendió en el período elegido y cuánto generó cada plato."
            filtros={<FiltroBusqueda value={busqueda} onChange={setBusqueda} placeholder="Buscar producto…" />}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <Th>Producto</Th>
                    <Th align="right" hint="Cantidad de unidades vendidas en el período.">
                      Unidades vendidas
                    </Th>
                    <Th align="right" hint="Precio de venta de una unidad de este producto (es fijo, no varía).">
                      Precio unitario
                    </Th>
                    <Th align="right" hint="Unidades vendidas × precio unitario.">
                      Total vendido
                    </Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filasPagina.map((p) => (
                    <tr key={p.productoId}>
                      <td className="px-3 py-2.5 font-medium text-neutral-900">{p.nombre}</td>
                      <td className="px-3 py-2.5 text-right text-neutral-700">{p.cantidad}</td>
                      <td className="px-3 py-2.5 text-right text-neutral-700">{bs(p.total / p.cantidad)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-neutral-900">{bs(p.total)}</td>
                    </tr>
                  ))}
                  {filasFiltradas.length === 0 && (
                    <FilaVacia colSpan={4}>
                      {reporte.porProducto.length === 0 ? "No se vendió nada en el período elegido." : "Ningún producto coincide con la búsqueda."}
                    </FilaVacia>
                  )}
                </tbody>
              </table>
            </div>
            <Paginacion
              pagina={pagina}
              totalPaginas={totalPaginas}
              totalItems={filasFiltradas.length}
              tamano={tamanoPagina}
              onCambiarPagina={setPagina}
              onCambiarTamano={setTamanoPagina}
            />
          </TablaSeccion>
        </>
      ) : (
        <p className="text-sm text-neutral-400">Cargando…</p>
      )}
    </div>
  );
}
