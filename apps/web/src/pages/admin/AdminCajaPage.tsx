import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { CajaTurno, CategoriaMovimientoCaja, MovimientoCaja } from "shared";
import { SOCKET_EVENTS } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { useSocket } from "../../lib/socketContext";
import { formatBs } from "../../lib/format";
import { Modal } from "../../components/Modal";
import { IconInput } from "../../components/IconInput";
import { IconCheck, IconCoin, IconPlus, IconTag, IconTrash } from "../../components/icons";
import { Badge, FiltroBusqueda, FiltroChip, TablaSeccion } from "../../components/TablaSeccion";

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

export function AdminCajaPage() {
  const { token } = useAuth();
  const socket = useSocket();
  const [turno, setTurno] = useState<CajaTurno | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalCerrar, setModalCerrar] = useState(false);
  const [modalMovimiento, setModalMovimiento] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros de la tabla del libro de caja — siempre visibles. Por defecto se
  // ve el turno abierto; si se elige un rango de fechas, se ve el histórico
  // completo de esas fechas (útil para revisar días anteriores), no solo el
  // turno actual.
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | "INGRESO" | "EGRESO">("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const verHistorico = Boolean(filtroDesde && filtroHasta);

  async function cargar() {
    const activo = await apiFetch<CajaTurno | null>("/caja/turnos/activo", token);
    setTurno(activo);
    const params = new URLSearchParams();
    if (filtroDesde && filtroHasta) {
      params.set("desde", new Date(`${filtroDesde}T00:00:00`).toISOString());
      params.set("hasta", new Date(`${filtroHasta}T23:59:59`).toISOString());
    } else if (activo) {
      params.set("turnoId", activo.id);
    }
    const lista = await apiFetch<MovimientoCaja[]>(`/caja/movimientos?${params.toString()}`, token);
    setMovimientos(lista);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filtroDesde, filtroHasta]);

  useEffect(() => {
    if (!socket) return;
    const onMovimiento = () => cargar();
    socket.on(SOCKET_EVENTS.CAJA_MOVIMIENTO_REGISTRADO, onMovimiento);
    return () => {
      socket.off(SOCKET_EVENTS.CAJA_MOVIMIENTO_REGISTRADO, onMovimiento);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, turno?.id, filtroDesde, filtroHasta]);

  async function anular(id: string) {
    setError(null);
    try {
      await apiFetch(`/caja/movimientos/${id}/anular`, token, { method: "POST" });
      cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo anular el movimiento");
    }
  }

  const totalIngresos = movimientos.filter((m) => m.tipo === "INGRESO" && !m.anulado).reduce((s, m) => s + m.monto, 0);
  const totalEgresos = movimientos.filter((m) => m.tipo === "EGRESO" && !m.anulado).reduce((s, m) => s + m.monto, 0);

  const movimientosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return movimientos.filter((m) => {
      if (filtroTipo !== "TODOS" && m.tipo !== filtroTipo) return false;
      if (!termino) return true;
      return (
        m.concepto.toLowerCase().includes(termino) ||
        m.registradoPorNombre.toLowerCase().includes(termino) ||
        (CATEGORIA_LABEL[m.categoria] ?? m.categoria).toLowerCase().includes(termino)
      );
    });
  }, [movimientos, filtroTipo, busqueda]);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <h1 className="text-lg font-semibold text-neutral-900">Caja y dinero</h1>

      {!cargando && !turno && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
          <p className="mb-2 font-medium">No hay un turno de caja abierto.</p>
          <p className="mb-3 text-xs">
            Las ventas se registran igual aunque no abras turno, pero abrirlo te deja contar el efectivo al
            cerrar y comparar contra lo que el sistema calculó.
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
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
              <p className="text-xs uppercase tracking-wide">{verHistorico ? "Ingresos del período" : "Ingresos del turno"}</p>
              <p className="text-lg font-bold">Bs {formatBs(totalIngresos)}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-2 text-red-700">
              <p className="text-xs uppercase tracking-wide">{verHistorico ? "Egresos del período" : "Egresos del turno"}</p>
              <p className="text-lg font-bold">Bs {formatBs(totalEgresos)}</p>
            </div>
          </div>
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <TablaSeccion
        icono={IconCoin}
        acento="ambar"
        titulo="Libro de ingresos y egresos"
        descripcion={
          verHistorico
            ? "Historial de movimientos en el rango de fechas elegido (todos los turnos)."
            : "Movimientos del turno abierto — elegí un rango de fechas para ver el histórico."
        }
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
            <FiltroBusqueda value={busqueda} onChange={setBusqueda} placeholder="Buscar por concepto, categoría o quién lo registró…" />
            <div className="ml-auto flex items-center gap-1.5">
              <input
                type="date"
                value={filtroDesde}
                onChange={(e) => setFiltroDesde(e.target.value)}
                title="Desde"
                className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
              />
              <span className="text-xs text-neutral-400">a</span>
              <input
                type="date"
                value={filtroHasta}
                onChange={(e) => setFiltroHasta(e.target.value)}
                title="Hasta"
                className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
              />
              {verHistorico && (
                <button
                  onClick={() => { setFiltroDesde(""); setFiltroHasta(""); }}
                  className="rounded-lg bg-neutral-100 px-2 py-1.5 text-xs font-medium text-neutral-600"
                >
                  Volver al turno
                </button>
              )}
            </div>
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
        <ul className="divide-y divide-neutral-100">
          {movimientosFiltrados.map((m) => (
            <li key={m.id} className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 py-3 ${m.anulado ? "opacity-50" : ""}`}>
              <div className="min-w-0">
                <p>
                  <span className={m.anulado ? "text-neutral-400 line-through" : "font-medium text-neutral-900"}>
                    {m.concepto}
                  </span>
                  {m.anulado && (
                    <span className="ml-1.5">
                      <Badge tono="gris" hint="Este movimiento fue anulado: no cuenta en los totales, pero queda visible para auditoría.">
                        anulado
                      </Badge>
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-500">
                  {formatoHora(m.creadoEn)} · {CATEGORIA_LABEL[m.categoria] ?? m.categoria}
                  {m.metodoPago ? ` · ${m.metodoPago}` : ""} · {m.registradoPorNombre}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`font-semibold ${m.tipo === "INGRESO" ? "text-emerald-600" : "text-red-600"}`}>
                  {m.tipo === "INGRESO" ? "+" : "-"}Bs {formatBs(m.monto)}
                </span>
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
              </div>
            </li>
          ))}
          {movimientosFiltrados.length === 0 && !cargando && (
            <p className="py-6 text-center text-sm text-neutral-400">
              {movimientos.length === 0 ? "Todavía no hay movimientos en este rango." : "Ningún movimiento coincide con el filtro."}
            </p>
          )}
        </ul>
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

function AbrirTurnoModal({ token, onCerrar, onListo }: { token: string | null; onCerrar: () => void; onListo: () => void }) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/caja/turnos", token, {
        method: "POST",
        body: JSON.stringify({ fondoInicial: Number(form.get("fondoInicial")) }),
      });
      onListo();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo abrir el turno");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Abrir turno de caja" onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <IconInput
          icon={IconCoin}
          name="fondoInicial"
          type="number"
          step="0.01"
          min="0"
          placeholder="Fondo inicial en efectivo"
          required
          autoFocus
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={guardando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <IconCheck width={16} height={16} />
          {guardando ? "Abriendo…" : "Confirmar apertura"}
        </button>
      </form>
    </Modal>
  );
}

function CerrarTurnoModal({
  token,
  turno,
  onCerrar,
  onListo,
}: {
  token: string | null;
  turno: CajaTurno;
  onCerrar: () => void;
  onListo: () => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const nota = String(form.get("notaCierre") ?? "").trim();
    try {
      await apiFetch(`/caja/turnos/${turno.id}/cerrar`, token, {
        method: "PATCH",
        body: JSON.stringify({ efectivoContado: Number(form.get("efectivoContado")), notaCierre: nota || undefined }),
      });
      onListo();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cerrar el turno");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Cerrar turno de caja" onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-xs text-neutral-500">
          Contá el efectivo real en caja e ingresalo abajo — el sistema calcula la diferencia contra lo que
          debería haber (fondo inicial + ventas en efectivo del turno).
        </p>
        <IconInput
          icon={IconCoin}
          name="efectivoContado"
          type="number"
          step="0.01"
          min="0"
          placeholder="Efectivo contado"
          required
          autoFocus
        />
        <IconInput icon={IconTag} name="notaCierre" placeholder="Nota (opcional)" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={guardando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <IconCheck width={16} height={16} />
          {guardando ? "Cerrando…" : "Confirmar cierre"}
        </button>
      </form>
    </Modal>
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

        {tipo === "EGRESO" && (
          <select name="categoria" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" required>
            {CATEGORIAS_EGRESO.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        )}

        <IconInput icon={IconTag} name="concepto" placeholder="Concepto" required autoFocus />
        <IconInput icon={IconCoin} name="monto" type="number" step="0.01" min="0.01" placeholder="Monto" required />
        <select name="metodoPago" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" defaultValue="EFECTIVO">
          <option value="EFECTIVO">Efectivo</option>
          <option value="TARJETA">Tarjeta</option>
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="QR">QR</option>
        </select>

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
