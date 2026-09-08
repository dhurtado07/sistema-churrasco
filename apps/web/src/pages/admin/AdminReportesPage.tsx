import { useEffect, useMemo, useState } from "react";
import type { HorasTrabajadasEmpleado, MarcaAsistencia, ReporteFinanciero } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, descargarArchivo, ApiError } from "../../lib/api";
import { formatBs, claveDiaBO, formatoFechaCortaDesdeClaveBO, formatoHoraBO } from "../../lib/format";
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
import { TablaSeccion, FiltroChip, FiltroBusqueda } from "../../components/TablaSeccion";
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

interface DiaTrabajado {
  clave: string;
  horas: number;
  marcas: MarcaAsistencia[];
}

/** Agrupa las marcas de un empleado por día real de Bolivia y calcula las
 * horas de cada día (mismo criterio de emparejar ENTRADA→SALIDA que usa el
 * servidor para el total, pero día por día) — para que el admin vea en qué
 * días trabajó y cuánto cada uno, no solo un total del período que no sirve
 * para calcular qué pagarle si faltó un día o hizo horas distintas cada vez. */
function agruparPorDia(marcas: MarcaAsistencia[]): DiaTrabajado[] {
  const porDia = new Map<string, MarcaAsistencia[]>();
  for (const marca of marcas) {
    const clave = claveDiaBO(marca.momento);
    const lista = porDia.get(clave) ?? [];
    lista.push(marca);
    porDia.set(clave, lista);
  }

  const dias: DiaTrabajado[] = [];
  for (const [clave, marcasDia] of porDia) {
    const ordenadas = [...marcasDia].sort((a, b) => new Date(a.momento).getTime() - new Date(b.momento).getTime());
    let totalMs = 0;
    let entradaAbierta: number | null = null;
    for (const m of ordenadas) {
      const t = new Date(m.momento).getTime();
      if (m.tipo === "ENTRADA") entradaAbierta = t;
      else if (m.tipo === "SALIDA" && entradaAbierta !== null) {
        totalMs += t - entradaAbierta;
        entradaAbierta = null;
      }
    }
    dias.push({ clave, horas: Math.round((totalMs / 3_600_000) * 100) / 100, marcas: ordenadas });
  }
  return dias.sort((a, b) => b.clave.localeCompare(a.clave));
}

interface DiaAsistencia extends DiaTrabajado {
  presente: boolean;
}

/** Completa CADA día del período elegido (no solo los que tienen marcas) —
 * agrupar por día solo mostraba cuándo SÍ vino; para saber qué días NO vino
 * hace falta la lista completa del período, con los días sin marcas marcados
 * como ausente en vez de simplemente no aparecer. */
function diasDelPeriodo(marcas: MarcaAsistencia[], desde: Date, hasta: Date): DiaAsistencia[] {
  const trabajados = new Map(agruparPorDia(marcas).map((d) => [d.clave, d]));
  const dias: DiaAsistencia[] = [];
  const vistos = new Set<string>();
  const cursor = new Date(desde);
  while (cursor <= hasta) {
    const clave = claveDiaBO(cursor.toISOString());
    if (!vistos.has(clave)) {
      vistos.add(clave);
      const trabajado = trabajados.get(clave);
      dias.push({ clave, presente: !!trabajado, horas: trabajado?.horas ?? 0, marcas: trabajado?.marcas ?? [] });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias.sort((a, b) => b.clave.localeCompare(a.clave));
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
  const [empleadoExpandido, setEmpleadoExpandido] = useState<string | null>(null);
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
          <ul className="divide-y divide-neutral-100">
            {nominaFiltrada.map((n) => {
              const expandido = empleadoExpandido === n.empleadoId;
              const dias = expandido ? diasDelPeriodo(n.marcas, desde, hasta) : [];
              const diasAusente = dias.filter((d) => !d.presente).length;
              return (
                <li key={n.empleadoId} className="py-3">
                  <button
                    onClick={() => setEmpleadoExpandido(expandido ? null : n.empleadoId)}
                    className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 text-left"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-900">{n.empleadoNombre}</p>
                      <p className="text-xs text-neutral-500">
                        {n.puesto} · {bs(n.sueldo)}/mes · {n.marcas.length} marca{n.marcas.length === 1 ? "" : "s"} ·{" "}
                        {expandido ? "ocultar días ▲" : "ver días ▼"}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-neutral-900">{n.horas.toFixed(1)} h</span>
                  </button>

                  {expandido && (
                    <div className="mt-2 overflow-hidden rounded-lg border border-neutral-100">
                      <p className="border-b border-neutral-100 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-500">
                        {dias.length - diasAusente} día{dias.length - diasAusente === 1 ? "" : "s"} presente
                        {dias.length - diasAusente === 1 ? "" : "s"} · {diasAusente} ausente{diasAusente === 1 ? "" : "s"}{" "}
                        de {dias.length} en el período.
                      </p>
                      <div className="max-h-72 overflow-y-auto overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-neutral-100 text-neutral-500">
                              <th className="px-3 py-2 text-left font-semibold">Día</th>
                              <th className="px-3 py-2 text-left font-semibold">Estado</th>
                              <th className="px-3 py-2 text-left font-semibold">Marcas (entrada/salida)</th>
                              <th className="px-3 py-2 text-right font-semibold">Horas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-50">
                            {dias.map((d) => (
                              <tr key={d.clave} className={d.presente ? "" : "bg-neutral-50/60"}>
                                <td className="px-3 py-2 font-medium text-neutral-900">
                                  {formatoFechaCortaDesdeClaveBO(d.clave)}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      d.presente ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-500"
                                    }`}
                                  >
                                    {d.presente ? "Presente" : "Ausente"}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-neutral-600">
                                  {d.marcas.length > 0
                                    ? d.marcas
                                        .map((m) => `${m.tipo === "ENTRADA" ? "E" : "S"} ${formatoHoraBO(m.momento)}`)
                                        .join(" · ")
                                    : "—"}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-neutral-900">
                                  {d.presente ? `${d.horas.toFixed(1)} h` : "—"}
                                </td>
                              </tr>
                            ))}
                            {dias.length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-3 py-4 text-center text-neutral-400">
                                  El período elegido no tiene días.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
            {nominaFiltrada.length === 0 && (
              <p className="py-6 text-center text-sm text-neutral-400">
                {nomina.length === 0 ? "No hay empleados con marcas en este período." : "Nadie coincide con la búsqueda."}
              </p>
            )}
          </ul>
        </TablaSeccion>
      )}
    </div>
  );
}
