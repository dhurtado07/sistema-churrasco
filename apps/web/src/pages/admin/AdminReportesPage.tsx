import { useEffect, useMemo, useState } from "react";
import type { HorasTrabajadasEmpleado, ReporteFinanciero } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, descargarArchivo, ApiError } from "../../lib/api";
import { formatBs, formatoFechaCortaDesdeClaveBO, formatoHoraBO } from "../../lib/format";
import { agruparPorDia } from "../../lib/asistencia";
import {
  IconAsistencia,
  IconCoin,
  IconCompra,
  IconDescarga,
  IconGanancias,
  IconInventario,
  IconPrint,
} from "../../components/icons";
import { StatCard } from "../../components/StatCard";
import { TablaSeccion, FiltroChip, FiltroBusqueda, Th, FilaVacia, Paginacion } from "../../components/TablaSeccion";
import { BarrasAgrupadas, BarrasCategoria, BarrasRanking, Dona, PALETA } from "../../components/Charts";

type Preset = "dia" | "semana" | "mes" | "anio";

function rangoDePreset(preset: Preset): { desde: Date; hasta: Date; agrupar: "dia" | "semana" | "mes" } {
  const hasta = new Date();
  hasta.setHours(23, 59, 59, 999);
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);

  if (preset === "dia") return { desde, hasta, agrupar: "dia" };
  if (preset === "semana") {
    desde.setDate(desde.getDate() - 6);
    return { desde, hasta, agrupar: "dia" };
  }
  if (preset === "mes") {
    desde.setDate(1);
    return { desde, hasta, agrupar: "dia" };
  }
  desde.setMonth(0, 1);
  return { desde, hasta, agrupar: "mes" };
}

const CATEGORIA_LABEL: Record<string, string> = {
  COMPRA_INSUMO: "Insumos",
  PAGO_PROVEEDOR: "Proveedores",
  SUELDO: "Sueldos",
  SERVICIO: "Servicios",
  OTRO: "Otro",
  // "VENTA" como EGRESO solo aparece cuando se anula/edita un pedido pagado
  // (el reverso de esa venta) — nunca es una venta real saliendo de caja.
  VENTA: "Anulación de venta",
};
// Color fijo por categoría (nunca por posición): agregar/quitar una categoría
// no debe repintar las demás.
const COLOR_CATEGORIA: Record<string, string> = {
  COMPRA_INSUMO: PALETA.azul,
  PAGO_PROVEEDOR: PALETA.naranja,
  SUELDO: PALETA.aqua,
  SERVICIO: PALETA.amarillo,
  OTRO: PALETA.magenta,
  VENTA: PALETA.violeta,
};

const METODO_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  QR: "QR",
};
const COLOR_METODO: Record<string, string> = {
  EFECTIVO: PALETA.azul,
  TARJETA: PALETA.naranja,
  TRANSFERENCIA: PALETA.aqua,
  QR: PALETA.amarillo,
};

const COLOR_TIPO_CONSUMO: Record<string, string> = {
  LOCAL: PALETA.azul,
  LLEVAR: PALETA.naranja,
};

const bs = (v: number) => `Bs ${formatBs(v)}`;

interface RegistroAsistencia {
  clave: string;
  empleadoId: string;
  empleadoNombre: string;
  horas: number;
  horaIngreso: string | null;
  horaSalida: string | null;
}

/** Aplana las horas por empleado en un solo registro por (empleado, día
 * trabajado) — una tabla, no una lista para expandir por empleado — con la
 * primera entrada y la última salida de ese día. Solo días con marcas (una
 * fila sin entrada/salida no tiene sentido acá). */
function registrosDeAsistencia(nomina: HorasTrabajadasEmpleado[]): RegistroAsistencia[] {
  const registros: RegistroAsistencia[] = [];
  for (const empleado of nomina) {
    for (const dia of agruparPorDia(empleado.marcas)) {
      const entradas = dia.marcas.filter((m) => m.tipo === "ENTRADA");
      const salidas = dia.marcas.filter((m) => m.tipo === "SALIDA");
      registros.push({
        clave: dia.clave,
        empleadoId: empleado.empleadoId,
        empleadoNombre: empleado.empleadoNombre,
        horas: dia.horas,
        horaIngreso: entradas[0]?.momento ?? null,
        horaSalida: salidas[salidas.length - 1]?.momento ?? null,
      });
    }
  }
  return registros.sort((a, b) => b.clave.localeCompare(a.clave) || a.empleadoNombre.localeCompare(b.empleadoNombre));
}

export function AdminReportesPage() {
  const { token } = useAuth();
  const [preset, setPreset] = useState<Preset>("semana");
  const [desdeManual, setDesdeManual] = useState("");
  const [hastaManual, setHastaManual] = useState("");
  const [usarRangoManual, setUsarRangoManual] = useState(false);
  const [reporte, setReporte] = useState<ReporteFinanciero | null>(null);
  const [nomina, setNomina] = useState<HorasTrabajadasEmpleado[]>([]);
  const [tab, setTab] = useState<"financiero" | "nomina">("financiero");
  const [busquedaNomina, setBusquedaNomina] = useState("");
  const [paginaAsistencia, setPaginaAsistencia] = useState(1);
  const [tamanoPaginaAsistencia, setTamanoPaginaAsistencia] = useState(50);
  const [error, setError] = useState<string | null>(null);

  const datosPorCategoria = useMemo(
    () =>
      (reporte?.porCategoriaEgreso ?? []).map((c) => ({
        clave: c.categoria,
        etiqueta: CATEGORIA_LABEL[c.categoria] ?? c.categoria,
        total: c.total,
      })),
    [reporte],
  );

  const datosPorMetodo = useMemo(
    () =>
      (reporte?.porMetodoPago ?? []).map((m) => ({
        clave: m.metodoPago,
        etiqueta: METODO_LABEL[m.metodoPago] ?? m.metodoPago,
        total: m.total,
      })),
    [reporte],
  );

  const datosPorTipoConsumo = useMemo(() => {
    if (!reporte) return [];
    return [
      { clave: "LOCAL", etiqueta: "En el local", total: reporte.porTipoConsumo.LOCAL },
      { clave: "LLEVAR", etiqueta: "Para llevar", total: reporte.porTipoConsumo.LLEVAR },
    ].filter((d) => d.total > 0);
  }, [reporte]);

  const datosTopProductos = useMemo(
    () => (reporte?.porProducto ?? []).map((p) => ({ etiqueta: p.nombre, total: p.total, cantidad: p.cantidad })),
    [reporte],
  );

  const nominaFiltrada = useMemo(() => {
    const termino = busquedaNomina.trim().toLowerCase();
    if (!termino) return nomina;
    return nomina.filter(
      (n) => n.empleadoNombre.toLowerCase().includes(termino) || n.puesto.toLowerCase().includes(termino),
    );
  }, [nomina, busquedaNomina]);

  const registrosAsistencia = useMemo(() => registrosDeAsistencia(nominaFiltrada), [nominaFiltrada]);
  useEffect(() => {
    setPaginaAsistencia(1);
  }, [busquedaNomina, nomina, tamanoPaginaAsistencia]);
  const totalPaginasAsistencia = Math.max(1, Math.ceil(registrosAsistencia.length / tamanoPaginaAsistencia));
  const registrosPagina = useMemo(() => {
    const inicio = (paginaAsistencia - 1) * tamanoPaginaAsistencia;
    return registrosAsistencia.slice(inicio, inicio + tamanoPaginaAsistencia);
  }, [registrosAsistencia, paginaAsistencia, tamanoPaginaAsistencia]);

  const { desde, hasta, agrupar } = useMemo(() => {
    if (usarRangoManual && desdeManual && hastaManual) {
      const d = new Date(desdeManual);
      d.setHours(0, 0, 0, 0);
      const h = new Date(hastaManual);
      h.setHours(23, 59, 59, 999);
      const dias = (h.getTime() - d.getTime()) / 86_400_000;
      return { desde: d, hasta: h, agrupar: dias > 60 ? ("mes" as const) : ("dia" as const) };
    }
    return rangoDePreset(preset);
  }, [preset, usarRangoManual, desdeManual, hastaManual]);

  useEffect(() => {
    setError(null);
    apiFetch<ReporteFinanciero>(
      `/reportes/financiero?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}&agrupar=${agrupar}`,
      token,
    )
      .then(setReporte)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo cargar el reporte"));

    apiFetch<HorasTrabajadasEmpleado[]>(`/asistencia?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`, token)
      .then(setNomina)
      .catch(() => setNomina([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, desde.getTime(), hasta.getTime(), agrupar]);

  async function exportarFinancieroExcel() {
    try {
      await descargarArchivo(
        `/reportes/financiero/excel?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}&agrupar=${agrupar}`,
        token,
        "reporte-financiero.xlsx",
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo exportar el reporte");
    }
  }

  async function exportarNominaExcel() {
    try {
      await descargarArchivo(`/asistencia/excel?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`, token, "nomina.xlsx");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo exportar la nómina");
    }
  }

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Reportes</h1>
          <p className="text-xs text-neutral-500">El panel de control del negocio: cómo entra y sale la plata, y en qué.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium no-imprimir"
        >
          <IconPrint width={14} height={14} />
          Imprimir
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 no-imprimir">
        {(["dia", "semana", "mes", "anio"] as Preset[]).map((p) => (
          <FiltroChip key={p} activo={!usarRangoManual && preset === p} acento="azul" onClick={() => { setPreset(p); setUsarRangoManual(false); }}>
            {p === "dia" ? "Hoy" : p === "semana" ? "Últimos 7 días" : p === "mes" ? "Este mes" : "Este año"}
          </FiltroChip>
        ))}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={desdeManual}
            onChange={(e) => { setDesdeManual(e.target.value); setUsarRangoManual(true); }}
            className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
          />
          <span className="text-xs text-neutral-400">a</span>
          <input
            type="date"
            value={hastaManual}
            onChange={(e) => { setHastaManual(e.target.value); setUsarRangoManual(true); }}
            className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
          />
        </div>
      </div>

      <div className="flex gap-1.5 no-imprimir">
        <FiltroChip activo={tab === "financiero"} acento="esmeralda" onClick={() => setTab("financiero")}>
          Financiero
        </FiltroChip>
        <FiltroChip activo={tab === "nomina"} acento="rosa" onClick={() => setTab("nomina")}>
          Nómina / asistencia
        </FiltroChip>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {tab === "financiero" && reporte && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icono={IconCoin}
              acento="esmeralda"
              label="Ingresos"
              value={bs(reporte.totalIngresos)}
              hint="Todo lo que entró: ventas cobradas en el período, sin restar nada todavía."
            />
            <StatCard
              icono={IconCompra}
              acento="rojo"
              label="Egresos"
              value={bs(reporte.totalEgresos)}
              hint="Todo lo que salió: compras de insumos, sueldos, servicios y otros gastos registrados en el libro de caja."
            />
            <StatCard
              icono={IconInventario}
              acento="ambar"
              label="Inversión insumos"
              value={bs(reporte.totalInversionInsumos)}
              hint="Parte de los egresos que es específicamente compra de insumos (arroz, carne, verduras) — la inversión del negocio en materia prima."
            />
            <StatCard
              icono={IconGanancias}
              acento="azul"
              label="Ganancia neta"
              value={bs(reporte.gananciaNeta)}
              hint="Ingresos menos egresos del período. Es lo que realmente queda, no solo lo vendido."
            />
          </div>

          <button
            onClick={exportarFinancieroExcel}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium no-imprimir"
          >
            <IconDescarga width={14} height={14} />
            Exportar a Excel
          </button>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TablaSeccion
              icono={IconGanancias}
              acento="azul"
              titulo="Ingresos, egresos y ganancia neta"
              descripcion="Cómo se movió la plata día a día (o mes a mes) en el período elegido."
            >
              <BarrasAgrupadas
                datos={reporte.serie}
                formatear={bs}
                series={[
                  { clave: "ingresos", color: PALETA.azul, nombre: "Ingresos" },
                  { clave: "egresos", color: PALETA.naranja, nombre: "Egresos" },
                  { clave: "ganancia", color: PALETA.aqua, nombre: "Ganancia neta" },
                ]}
              />
            </TablaSeccion>

            <TablaSeccion
              icono={IconCompra}
              acento="naranja"
              titulo="Egresos por categoría"
              descripcion="En qué se fue la plata que salió: insumos, proveedores, sueldos, servicios u otros."
            >
              <BarrasCategoria datos={datosPorCategoria} colorPorClave={COLOR_CATEGORIA} formatear={bs} />
            </TablaSeccion>

            <TablaSeccion
              icono={IconCoin}
              acento="cian"
              titulo="Ingresos por método de pago"
              descripcion="Cuánto entró en efectivo vs. tarjeta, transferencia o QR — útil para saber cuánto efectivo esperar en caja."
            >
              <Dona datos={datosPorMetodo} colorPorClave={COLOR_METODO} formatear={bs} centroLabel="Ingresos" />
            </TablaSeccion>

            <TablaSeccion
              icono={IconAsistencia}
              acento="violeta"
              titulo="Local vs. para llevar"
              descripcion="Qué parte de las ventas fue para comer en el local y qué parte para llevar."
            >
              <Dona datos={datosPorTipoConsumo} colorPorClave={COLOR_TIPO_CONSUMO} formatear={bs} centroLabel="Ventas" />
            </TablaSeccion>

            <TablaSeccion
              icono={IconGanancias}
              acento="esmeralda"
              titulo="Platos más vendidos"
              descripcion="Los productos que más plata generaron en el período (no solo los más pedidos)."
              className="lg:col-span-2"
            >
              <BarrasRanking
                datos={datosTopProductos}
                color={PALETA.azul}
                formatear={bs}
                etiquetaPrefijo="Plato: "
                detalle={(d) => `Cantidad de platos vendidos: ${d.cantidad}`}
              />
            </TablaSeccion>
          </div>
        </>
      )}

      {tab === "nomina" && (
        <TablaSeccion
          icono={IconAsistencia}
          acento="rosa"
          titulo="Horas trabajadas por empleado"
          descripcion="Sueldo y horas marcadas (entrada/salida) de cada empleado en el período elegido."
          filtros={
            <FiltroBusqueda value={busquedaNomina} onChange={setBusquedaNomina} placeholder="Buscar por nombre o puesto…" />
          }
          acciones={
            <button
              onClick={exportarNominaExcel}
              className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium no-imprimir"
            >
              <IconDescarga width={14} height={14} />
              Exportar a Excel
            </button>
          }
        >
          <ul className="mb-4 divide-y divide-neutral-100">
            {nominaFiltrada.map((n) => (
              <li key={n.empleadoId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">{n.empleadoNombre}</p>
                  <p className="text-xs text-neutral-500">
                    {n.puesto} · {bs(n.sueldo)}/mes
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-neutral-900">{n.horas.toFixed(1)} h en total</span>
              </li>
            ))}
            {nominaFiltrada.length === 0 && (
              <p className="py-6 text-center text-sm text-neutral-400">
                {nomina.length === 0 ? "No hay empleados con marcas en este período." : "Nadie coincide con la búsqueda."}
              </p>
            )}
          </ul>

          <div className="overflow-x-auto border-t border-neutral-100 pt-3">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-neutral-100">
                  <Th>Fecha</Th>
                  <Th>Empleado</Th>
                  <Th align="right" hint="Resultado de emparejar entrada y salida de ese día.">
                    Horas trabajadas
                  </Th>
                  <Th align="right">Hora de ingreso</Th>
                  <Th align="right">Hora de salida</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {registrosPagina.map((r) => (
                  <tr key={`${r.empleadoId}-${r.clave}`}>
                    <td className="px-3 py-2.5 text-sm font-medium text-neutral-900">
                      {formatoFechaCortaDesdeClaveBO(r.clave)}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-neutral-700">{r.empleadoNombre}</td>
                    <td className="px-3 py-2.5 text-right text-sm font-semibold text-neutral-900">
                      {r.horas.toFixed(1)} h
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-neutral-700">
                      {r.horaIngreso ? formatoHoraBO(r.horaIngreso) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-neutral-700">
                      {r.horaSalida ? formatoHoraBO(r.horaSalida) : "—"}
                    </td>
                  </tr>
                ))}
                {registrosAsistencia.length === 0 && (
                  <FilaVacia colSpan={5}>Ningún empleado marcó asistencia en el período elegido.</FilaVacia>
                )}
              </tbody>
            </table>
            <Paginacion
              pagina={paginaAsistencia}
              totalPaginas={totalPaginasAsistencia}
              totalItems={registrosAsistencia.length}
              tamano={tamanoPaginaAsistencia}
              onCambiarPagina={setPaginaAsistencia}
              onCambiarTamano={setTamanoPaginaAsistencia}
            />
          </div>
        </TablaSeccion>
      )}
    </div>
  );
}
