import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { CajaTurno, CategoriaMovimientoCaja, MetodoPago, MovimientoCaja, TurnoConVentas } from "shared";
import { SOCKET_EVENTS, codigoPedido } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { useSocket } from "../../lib/socketContext";
import { formatBs } from "../../lib/format";
import { METODO_LABEL } from "../../lib/metodoPago";
import { Modal } from "../../components/Modal";
import { IconInput } from "../../components/IconInput";
import { Campo } from "../../components/Campo";
import { AbrirTurnoModal } from "../../components/AbrirTurnoModal";
import { CerrarTurnoModal } from "../../components/CerrarTurnoModal";
import { IconCheck, IconCoin, IconPlus, IconTag, IconTrash } from "../../components/icons";
import { Badge, FilaVacia, FiltroBusqueda, FiltroChip, Paginacion, TablaSeccion, Th } from "../../components/TablaSeccion";

const CATEGORIA_LABEL: Record<string, string> = {
  VENTA: "Venta",
  COMPRA_INSUMO: "Compra de insumos",
  PAGO_PROVEEDOR: "Pago a proveedor",
  SUELDO: "Sueldo",
  SERVICIO: "Servicio",
  OTRO: "Otro",
};

const CATEGORIAS_EGRESO: { valor: CategoriaMovimientoCaja; etiqueta: string }[] = [
  { valor: "COMPRA_INSUMO", etiqueta: "Compra de insumos" },
  { valor: "PAGO_PROVEEDOR", etiqueta: "Pago a proveedor" },
  { valor: "SUELDO", etiqueta: "Sueldo" },
  { valor: "SERVICIO", etiqueta: "Servicio (luz, agua, etc.)" },
  { valor: "OTRO", etiqueta: "Otro" },
];

function formatoHora(iso: string) {
  return new Date(iso).toLocaleString("es-BO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Un movimiento anulado, o el reverso que anula a otro, no es plata real que
 * entró o salió — es solo el registro contable de una corrección. Único punto
 * de verdad para esta regla en el frontend (ver MOVIMIENTO_REAL_WHERE en el
 * server, mismo criterio). */
function esParteDeAnulacion(m: MovimientoCaja): boolean {
  return m.anulado || !!m.anulaMovimientoId;
}

/** Caso específico de lo anterior: una venta de un pedido CANCELADO. Editar un
 * pedido también deja un movimiento anulado y su reverso, pero el pedido sigue
 * vigente — eso es una corrección, no una cancelación. Tampoco lo es una
 * corrección manual de otra categoría (ej. un "Pago a proveedor" mal cargado). */
function esCancelacionDeVenta(m: MovimientoCaja): boolean {
  return m.categoria === "VENTA" && esParteDeAnulacion(m) && m.pedidoEstado === "CANCELADO";
}

type PresetCaja = "dia" | "semana" | "mes";

const PRESET_LABEL: Record<PresetCaja, string> = {
  dia: "Último día",
  semana: "Última semana",
  mes: "Último mes",
};

function rangoCajaPreset(preset: PresetCaja): { desde: Date; hasta: Date } {
  const hasta = new Date();
  hasta.setHours(23, 59, 59, 999);
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);

  if (preset === "dia") return { desde, hasta };
  if (preset === "semana") {
    desde.setDate(desde.getDate() - 6);
    return { desde, hasta };
  }
  desde.setDate(1);
  return { desde, hasta };
}

/** Una línea de la verificación de un turno: lo que el sistema calculó contra
 * lo que el cajero contó/vio a mano, con el resultado en una palabra. */
function LineaVerificacion({
  etiqueta,
  verbo,
  esperado,
  contado,
}: {
  etiqueta: string;
  verbo: string;
  esperado: number;
  contado: number;
}) {
  const diferencia = Math.round((contado - esperado) * 100) / 100;
  return (
    <p className="flex flex-wrap items-center justify-end gap-x-1.5 text-xs text-neutral-600">
      <span className="font-semibold text-neutral-800">{etiqueta}</span>
      <span>
        {verbo} Bs {formatBs(contado)} de Bs {formatBs(esperado)}
      </span>
      {diferencia === 0 ? (
        <Badge tono="verde">Cuadra</Badge>
      ) : diferencia < 0 ? (
        <Badge tono="rojo">Faltan Bs {formatBs(-diferencia)}</Badge>
      ) : (
        <Badge tono="ambar">Sobran Bs {formatBs(diferencia)}</Badge>
      )}
    </p>
  );
}

/** Verificación de un turno cerrado: efectivo contado y, si hubo, lo visto en
 * la app de QR/tarjeta/transferencia — todos con el mismo formato. */
function VerificacionTurno({ turno }: { turno: TurnoConVentas }) {
  if (turno.estado === "ABIERTO") return <span className="text-xs text-neutral-400">Turno abierto</span>;

  const otros = (Object.entries(turno.ventasPorMetodo) as [MetodoPago, number][]).filter(([m]) => m !== "EFECTIVO");
  return (
    <div className="space-y-1">
      {turno.efectivoContado != null && turno.efectivoEsperado != null && (
        <LineaVerificacion
          etiqueta="Efectivo"
          verbo="contaste"
          esperado={turno.efectivoEsperado}
          contado={turno.efectivoContado}
        />
      )}
      {otros.map(([metodo, vendido]) => {
        const verificado = turno.conteoOtrosMetodos?.[metodo as Exclude<MetodoPago, "EFECTIVO">];
        return verificado ? (
          <LineaVerificacion
            key={metodo}
            etiqueta={METODO_LABEL[metodo]}
            verbo="viste"
            esperado={verificado.esperado}
            contado={verificado.contado}
          />
        ) : (
          <p key={metodo} className="text-right text-xs text-neutral-400">
            <span className="font-semibold">{METODO_LABEL[metodo]}</span> sin verificar (Bs {formatBs(vendido)})
          </p>
        );
      })}
    </div>
  );
}

export function AdminCajaPage() {
  const { token } = useAuth();
  const socket = useSocket();
  const [turno, setTurno] = useState<CajaTurno | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [turnos, setTurnos] = useState<TurnoConVentas[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalCerrar, setModalCerrar] = useState(false);
  const [modalMovimiento, setModalMovimiento] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros de la tabla del libro de caja — siempre visibles. Por defecto se
  // ve "Último mes" (no solo el turno actual); un preset de período elige el
  // rango, con un rango manual como opción para casos puntuales.
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | "INGRESO" | "EGRESO" | "CANCELADOS">("TODOS");
  const [filtroMetodo, setFiltroMetodo] = useState<MetodoPago | "TODOS">("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [preset, setPreset] = useState<PresetCaja>("mes");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [usarRangoManual, setUsarRangoManual] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(25);

  const { desde, hasta } = useMemo(() => {
    if (usarRangoManual && filtroDesde && filtroHasta) {
      const d = new Date(`${filtroDesde}T00:00:00`);
      const h = new Date(`${filtroHasta}T23:59:59`);
      return { desde: d, hasta: h };
    }
    return rangoCajaPreset(preset);
  }, [preset, usarRangoManual, filtroDesde, filtroHasta]);

  async function cargar() {
    const activo = await apiFetch<CajaTurno | null>("/caja/turnos/activo", token);
    setTurno(activo);
    const params = new URLSearchParams({ desde: desde.toISOString(), hasta: hasta.toISOString() });
    const lista = await apiFetch<MovimientoCaja[]>(`/caja/movimientos?${params.toString()}`, token);
    setMovimientos(lista);
    setTurnos(await apiFetch<TurnoConVentas[]>(`/caja/turnos?${params.toString()}`, token));
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, desde.getTime(), hasta.getTime()]);

  useEffect(() => {
    if (!socket) return;
    const onMovimiento = () => cargar();
    socket.on(SOCKET_EVENTS.CAJA_MOVIMIENTO_REGISTRADO, onMovimiento);
    return () => {
      socket.off(SOCKET_EVENTS.CAJA_MOVIMIENTO_REGISTRADO, onMovimiento);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, desde.getTime(), hasta.getTime()]);

  async function anular(id: string) {
    setError(null);
    try {
      await apiFetch(`/caja/movimientos/${id}/anular`, token, { method: "POST" });
      cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo anular el movimiento");
    }
  }

  // Sin excluir anulaciones, el reverso (tipo EGRESO) de una venta cancelada
  // se sumaría como egreso real, inflando el total (mismo criterio que
  // reporteFinanciero, ver reportes/service.ts).
  const totalIngresos = movimientos
    .filter((m) => m.tipo === "INGRESO" && !esParteDeAnulacion(m))
    .reduce((s, m) => s + m.monto, 0);
  const totalEgresos = movimientos
    .filter((m) => m.tipo === "EGRESO" && !esParteDeAnulacion(m))
    .reduce((s, m) => s + m.monto, 0);
  const neto = totalIngresos - totalEgresos;

  const movimientosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return movimientos.filter((m) => {
      // "Ingresos"/"Egresos" siempre excluyen cualquier anulación (sea cual
      // sea su categoría) porque no es plata real que entró o salió. "Cancelados"
      // en cambio es específico de VENTA: junta las dos mitades de un pedido
      // cancelado (el ingreso original, tachado, y su reverso en egresos) para
      // poder revisarlas juntas. Una corrección manual de otra categoría (ej.
      // un "Pago a proveedor" mal cargado y anulado) no es un pedido cancelado,
      // así que no entra acá — sigue visible (atenuada) solo en "Todos".
      if (filtroTipo === "CANCELADOS") {
        if (!esCancelacionDeVenta(m)) return false;
      } else if (filtroTipo !== "TODOS") {
        if (m.tipo !== filtroTipo || esParteDeAnulacion(m)) return false;
      }
      if (filtroMetodo !== "TODOS" && m.metodoPago !== filtroMetodo) return false;
      if (!termino) return true;
      return (
        m.concepto.toLowerCase().includes(termino) ||
        m.registradoPorNombre.toLowerCase().includes(termino) ||
        (CATEGORIA_LABEL[m.categoria] ?? m.categoria).toLowerCase().includes(termino)
      );
    });
  }, [movimientos, filtroTipo, filtroMetodo, busqueda]);

  // En "Cancelados" el neto de ingreso-egreso siempre da cero (es la gracia:
  // la venta no debe afectar la caja) — mostrar "Bs 0.00" ahí no le dice nada
  // al admin sobre cuánto se canceló. En cambio mostramos el total vendido
  // que se anuló (el lado INGRESO de cada par, sin contarlo dos veces con su
  // reverso). El resto de las vistas sigue mostrando el neto de lo filtrado.
  // Un pedido editado y luego cancelado deja varios ingresos anulados: cuenta
  // solo el último (lo que realmente valía al cancelarse).
  const cancelados = new Map<number | null, { creadoEn: string; monto: number }>();
  if (filtroTipo === "CANCELADOS") {
    for (const m of movimientosFiltrados) {
      if (m.tipo !== "INGRESO") continue;
      const previo = cancelados.get(m.pedidoId);
      if (!previo || m.creadoEn > previo.creadoEn) cancelados.set(m.pedidoId, { creadoEn: m.creadoEn, monto: m.monto });
    }
  }
  const cantidadCancelados = cancelados.size;

  const netoFiltrado =
    filtroTipo === "CANCELADOS"
      ? [...cancelados.values()].reduce((s, c) => s + c.monto, 0)
      : movimientosFiltrados
          .filter((m) => !esParteDeAnulacion(m))
          .reduce((s, m) => s + (m.tipo === "INGRESO" ? m.monto : -m.monto), 0);

  useEffect(() => {
    setPagina(1);
  }, [filtroTipo, filtroMetodo, busqueda, desde.getTime(), hasta.getTime(), tamano]);
  const totalPaginas = Math.max(1, Math.ceil(movimientosFiltrados.length / tamano));
  const movimientosPagina = movimientosFiltrados.slice((pagina - 1) * tamano, pagina * tamano);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <h1 className="text-lg font-semibold text-neutral-900">Caja y dinero</h1>

      {!cargando && !turno && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
          <p className="mb-2 font-medium">No hay un turno de caja abierto.</p>
          <p className="mb-3 text-xs">
            Caja no puede cobrar ningún pedido hasta que se abra un turno — abrilo acá para que puedan empezar a
            vender, y vas a poder contar el efectivo al cerrarlo y comparar contra lo que el sistema calculó.
          </p>
          <button
            onClick={() => setModalAbrir(true)}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
          >
            <IconCoin width={14} height={14} />
            Abrir turno
          </button>
        </section>
      )}

      {/* Totales arriba de todo, siempre visibles (con o sin turno abierto)
          para el período elegido — nunca hay que sumar la tabla a mano. */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Total — {usarRangoManual ? "rango elegido" : PRESET_LABEL[preset]}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(["dia", "semana", "mes"] as PresetCaja[]).map((p) => (
              <FiltroChip
                key={p}
                activo={!usarRangoManual && preset === p}
                acento="ambar"
                onClick={() => { setPreset(p); setUsarRangoManual(false); }}
              >
                {PRESET_LABEL[p]}
              </FiltroChip>
            ))}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={filtroDesde}
                onChange={(e) => { setFiltroDesde(e.target.value); setUsarRangoManual(true); }}
                title="Desde"
                className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
              />
              <span className="text-xs text-neutral-400">a</span>
              <input
                type="date"
                value={filtroHasta}
                onChange={(e) => { setFiltroHasta(e.target.value); setUsarRangoManual(true); }}
                title="Hasta"
                className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
              />
              {usarRangoManual && (
                <button
                  onClick={() => { setUsarRangoManual(false); setFiltroDesde(""); setFiltroHasta(""); }}
                  className="rounded-lg bg-neutral-100 px-2 py-1.5 text-xs font-medium text-neutral-600"
                >
                  Volver a {PRESET_LABEL.mes}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
            <p className="text-xs uppercase tracking-wide">Ingresos</p>
            <p className="text-lg font-bold">Bs {formatBs(totalIngresos)}</p>
          </div>
          <div className="rounded-lg bg-red-50 p-2 text-red-700">
            <p className="text-xs uppercase tracking-wide">Egresos</p>
            <p className="text-lg font-bold">Bs {formatBs(totalEgresos)}</p>
          </div>
          <div className="rounded-lg bg-neutral-100 p-2 text-neutral-900">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Neto</p>
            <p className="text-lg font-bold">Bs {formatBs(neto)}</p>
          </div>
        </div>
      </section>

      {turno && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Turno abierto</p>
              <p className="text-sm text-neutral-700">
                {turno.abiertoPorNombre} · desde {formatoHora(turno.abiertoEn)} · fondo inicial Bs{" "}
                {formatBs(turno.fondoInicial)}
              </p>
            </div>
            <button
              onClick={() => setModalCerrar(true)}
              className="rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-700"
            >
              Cerrar turno
            </button>
          </div>
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <TablaSeccion
        icono={IconCoin}
        acento="ambar"
        titulo="Libro de ingresos y egresos"
        descripcion={`Movimientos de ${usarRangoManual ? "el rango elegido" : PRESET_LABEL[preset].toLowerCase()} — cambiá el período arriba.`}
        filtros={
          <>
            <FiltroChip activo={filtroTipo === "TODOS"} acento="ambar" onClick={() => setFiltroTipo("TODOS")}>
              Todos
            </FiltroChip>
            <FiltroChip activo={filtroTipo === "INGRESO"} acento="esmeralda" onClick={() => setFiltroTipo("INGRESO")}>
              Ingresos
            </FiltroChip>
            <FiltroChip activo={filtroTipo === "EGRESO"} acento="rojo" onClick={() => setFiltroTipo("EGRESO")}>
              Egresos
            </FiltroChip>
            <FiltroChip activo={filtroTipo === "CANCELADOS"} acento="gris" onClick={() => setFiltroTipo("CANCELADOS")}>
              Pedidos cancelados
            </FiltroChip>
            <span className="mx-1 hidden h-5 w-px bg-neutral-200 sm:block" aria-hidden />
            {(["TODOS", "EFECTIVO", "QR", "TARJETA", "TRANSFERENCIA"] as const).map((metodo) => (
              <FiltroChip
                key={metodo}
                activo={filtroMetodo === metodo}
                acento="azul"
                onClick={() => setFiltroMetodo(metodo)}
              >
                {metodo === "TODOS" ? "Todos los métodos" : METODO_LABEL[metodo]}
              </FiltroChip>
            ))}
            <FiltroBusqueda value={busqueda} onChange={setBusqueda} placeholder="Buscar por concepto, categoría o quién lo registró…" />
          </>
        }
        acciones={
          <button
            onClick={() => setModalMovimiento(true)}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
          >
            <IconPlus width={14} height={14} />
            Registrar movimiento
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-neutral-100">
                <Th>Fecha</Th>
                <Th>Concepto</Th>
                <Th>Categoría</Th>
                <Th>Método</Th>
                <Th>Registrado por</Th>
                <Th align="right">Monto</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {movimientosPagina.map((m) => (
                <tr key={m.id} className={m.anulado || m.anulaMovimientoId ? "opacity-50" : ""}>
                  <td className="px-3 py-2.5 text-sm text-neutral-500">{formatoHora(m.creadoEn)}</td>
                  <td className="px-3 py-2.5 text-sm">
                    <span className={m.anulado ? "text-neutral-400 line-through" : "font-medium text-neutral-900"}>
                      {m.concepto}
                    </span>
                    {m.pedidoId != null && (
                      <span className="ml-1.5 text-xs text-neutral-400">{codigoPedido(m.pedidoId)}</span>
                    )}
                    {m.anulado && (
                      <span className="ml-1.5">
                        <Badge tono="gris" hint="Este movimiento fue anulado: no cuenta en los totales, pero queda visible para auditoría.">
                          anulado
                        </Badge>
                      </span>
                    )}
                    {!!m.anulaMovimientoId && esCancelacionDeVenta(m) && (
                      <span className="ml-1.5">
                        <Badge
                          tono="gris"
                          hint="Es el reverso de un pedido cancelado, no un egreso real del negocio — neutraliza la venta anulada y no cuenta en los totales de ingresos/egresos."
                        >
                          reverso de cancelación
                        </Badge>
                      </span>
                    )}
                    {!!m.anulaMovimientoId && !esCancelacionDeVenta(m) && (
                      <span className="ml-1.5">
                        <Badge
                          tono="gris"
                          hint="Es el reverso de una corrección (editar un pedido o un ajuste manual), no de un pedido cancelado — no cuenta en los totales de ingresos/egresos."
                        >
                          reverso de corrección
                        </Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-neutral-500">{CATEGORIA_LABEL[m.categoria] ?? m.categoria}</td>
                  <td className="px-3 py-2.5 text-sm text-neutral-500">{m.metodoPago ?? "—"}</td>
                  <td className="px-3 py-2.5 text-sm text-neutral-500">{m.registradoPorNombre}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`font-semibold ${m.tipo === "INGRESO" ? "text-emerald-600" : "text-red-600"}`}>
                      {m.tipo === "INGRESO" ? "+" : "-"}Bs {formatBs(m.monto)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {!m.anulado && m.categoria !== "VENTA" && (
                      <button
                        onClick={() => anular(m.id)}
                        title="Anular este movimiento"
                        className="inline-flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-red-600"
                      >
                        <IconTrash width={14} height={14} />
                        Anular
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {movimientosFiltrados.length === 0 && !cargando && (
                <FilaVacia colSpan={7}>
                  {movimientos.length === 0 ? "Todavía no hay movimientos en este rango." : "Ningún movimiento coincide con el filtro."}
                </FilaVacia>
              )}
            </tbody>
            {movimientosFiltrados.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-neutral-200">
                  <td colSpan={5} className="px-3 py-2.5 text-right text-sm font-semibold text-neutral-700">
                    {filtroTipo === "CANCELADOS"
                      ? `Total vendido y anulado (${cantidadCancelados} pedido${cantidadCancelados === 1 ? "" : "s"})`
                      : `Total de lo filtrado (${movimientosFiltrados.length} movimiento${movimientosFiltrados.length === 1 ? "" : "s"})`}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right text-sm font-bold ${
                      filtroTipo === "CANCELADOS" ? "text-neutral-600" : netoFiltrado >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {filtroTipo === "CANCELADOS" ? "" : netoFiltrado >= 0 ? "+" : "-"}Bs {formatBs(Math.abs(netoFiltrado))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
          <Paginacion
            pagina={pagina}
            totalPaginas={totalPaginas}
            totalItems={movimientosFiltrados.length}
            tamano={tamano}
            onCambiarPagina={setPagina}
            onCambiarTamano={setTamano}
          />
        </div>
      </TablaSeccion>


      <TablaSeccion
        icono={IconCoin}
        acento="azul"
        titulo="Turnos de caja"
        descripcion="Con cuánto se abrió cada caja y cómo cerró, medio por medio: lo que calculó el sistema contra lo que se contó o se vio en la app. El fondo inicial no es una venta: no cambia ganancias ni reportes."
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-neutral-100">
                <Th>Apertura</Th>
                <Th>Cierre</Th>
                <Th>Abierto por</Th>
                <Th align="right">Fondo inicial</Th>
                <Th align="right" hint="Total vendido en el turno, con el desglose por medio de pago.">
                  Ventas
                </Th>
                <Th
                  align="right"
                  hint="Al cerrar: lo que el sistema calculó contra lo que el cajero contó (efectivo) o vio en su app (QR, tarjeta, transferencia). El efectivo esperado incluye el fondo inicial."
                >
                  Verificación al cerrar
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {turnos.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2.5 text-sm text-neutral-500">{formatoHora(t.abiertoEn)}</td>
                  <td className="px-3 py-2.5 text-sm text-neutral-500">
                    {t.cerradoEn ? formatoHora(t.cerradoEn) : <Badge tono="verde">abierto</Badge>}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-neutral-500">{t.abiertoPorNombre}</td>
                  <td className="px-3 py-2.5 text-right text-sm font-medium">Bs {formatBs(t.fondoInicial)}</td>
                  <td className="px-3 py-2.5 text-right text-sm">
                    <span className="font-medium">Bs {formatBs(t.totalVendido)}</span>
                    {/* Desglose solo si hubo más de un medio o alguno que no es efectivo. */}
                    {Object.keys(t.ventasPorMetodo).some((m) => m !== "EFECTIVO") && (
                      <span className="block text-xs text-neutral-500">
                        {(Object.entries(t.ventasPorMetodo) as [MetodoPago, number][])
                          .map(([m, monto]) => `${METODO_LABEL[m]} ${formatBs(monto)}`)
                          .join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <VerificacionTurno turno={t} />
                  </td>
                </tr>
              ))}
              {turnos.length === 0 && !cargando && <FilaVacia colSpan={6}>No hay turnos de caja en este período.</FilaVacia>}
            </tbody>
          </table>
        </div>
      </TablaSeccion>

      {modalAbrir && (
        <AbrirTurnoModal
          token={token}
          onCerrar={() => setModalAbrir(false)}
          onListo={() => {
            setModalAbrir(false);
            cargar();
          }}
        />
      )}
      {modalCerrar && turno && (
        <CerrarTurnoModal
          token={token}
          turno={turno}
          onCerrar={() => setModalCerrar(false)}
          onListo={() => {
            setModalCerrar(false);
            cargar();
          }}
        />
      )}
      {modalMovimiento && (
        <MovimientoModal
          token={token}
          onCerrar={() => setModalMovimiento(false)}
          onListo={() => {
            setModalMovimiento(false);
            cargar();
          }}
        />
      )}
    </div>
  );
}

function MovimientoModal({ token, onCerrar, onListo }: { token: string | null; onCerrar: () => void; onListo: () => void }) {
  const [tipo, setTipo] = useState<"INGRESO" | "EGRESO">("EGRESO");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/caja/movimientos", token, {
        method: "POST",
        body: JSON.stringify({
          tipo,
          categoria: tipo === "INGRESO" ? "OTRO" : form.get("categoria"),
          concepto: form.get("concepto"),
          monto: Number(form.get("monto")),
          metodoPago: form.get("metodoPago") || undefined,
        }),
      });
      onListo();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el movimiento");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Registrar movimiento" onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Campo etiqueta="Tipo de movimiento">
          <div className="grid grid-cols-2 gap-2">
            {(["INGRESO", "EGRESO"] as const).map((opcion) => (
              <button
                key={opcion}
                type="button"
                onClick={() => setTipo(opcion)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  tipo === opcion ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {opcion === "INGRESO" ? "Ingreso" : "Egreso"}
              </button>
            ))}
          </div>
        </Campo>

        {tipo === "EGRESO" && (
          <Campo etiqueta="Categoría">
            <select name="categoria" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" required>
              {CATEGORIAS_EGRESO.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
        )}

        <Campo etiqueta="Concepto">
          <IconInput icon={IconTag} name="concepto" placeholder="Ej. Pago de luz" required autoFocus />
        </Campo>
        <Campo etiqueta="Monto (Bs)">
          <IconInput icon={IconCoin} name="monto" type="number" step="0.01" min="0.01" placeholder="0.00" required />
        </Campo>
        <Campo etiqueta="Método de pago">
          <select name="metodoPago" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" defaultValue="EFECTIVO">
            <option value="EFECTIVO">Efectivo</option>
            <option value="TARJETA">Tarjeta</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="QR">QR</option>
          </select>
        </Campo>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={guardando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <IconCheck width={16} height={16} />
          {guardando ? "Guardando…" : "Registrar"}
        </button>
      </form>
    </Modal>
  );
}
