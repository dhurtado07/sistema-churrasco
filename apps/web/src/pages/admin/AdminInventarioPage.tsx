import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ActivoInventario, EstadoActivoInventario } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { formatBs } from "../../lib/format";
import { Modal } from "../../components/Modal";
import { IconInput } from "../../components/IconInput";
import { IconCheck, IconInventario, IconPlus, IconTag } from "../../components/icons";
import { StatCard } from "../../components/StatCard";
import { FiltroBusqueda, FiltroChip, TablaSeccion } from "../../components/TablaSeccion";

const ESTADO_COLOR: Record<EstadoActivoInventario, string> = {
  BUENO: "bg-emerald-100 text-emerald-700",
  REGULAR: "bg-amber-100 text-amber-700",
  MALO: "bg-red-100 text-red-700",
  BAJA: "bg-neutral-200 text-neutral-500",
};

const ESTADOS: EstadoActivoInventario[] = ["BUENO", "REGULAR", "MALO", "BAJA"];

export function AdminInventarioPage() {
  const { token } = useAuth();
  const [activos, setActivos] = useState<ActivoInventario[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoActivoInventario | "TODOS">("TODOS");

  async function cargar() {
    setActivos(await apiFetch<ActivoInventario[]>("/inventario", token));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function cambiarEstado(activo: ActivoInventario, estado: EstadoActivoInventario) {
    await apiFetch(`/inventario/${activo.id}`, token, { method: "PATCH", body: JSON.stringify({ estado }) });
    cargar();
  }

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return activos.filter((a) => {
      if (filtroEstado !== "TODOS" && a.estado !== filtroEstado) return false;
      if (!termino) return true;
      return a.nombre.toLowerCase().includes(termino) || (a.categoria ?? "").toLowerCase().includes(termino);
    });
  }, [activos, busqueda, filtroEstado]);

  const valorTotal = filtrados.reduce((sum, a) => sum + (a.valorUnitario ?? 0) * a.cantidad, 0);
  const unidadesTotal = filtrados.reduce((sum, a) => sum + a.cantidad, 0);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Inventario del local</h1>
          <p className="text-xs text-neutral-500">
            Sillas, mesas, televisores y demás equipo — distinto de los insumos de cocina (eso va en Compras).
          </p>
        </div>
        <button
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
        >
          <IconPlus width={14} height={14} />
          Nuevo bien
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          icono={IconInventario}
          acento="cian"
          label="Valor estimado"
          value={`Bs ${formatBs(valorTotal)}`}
          hint="Suma de cantidad × valor unitario de los bienes que coinciden con el filtro."
        />
        <StatCard
          icono={IconInventario}
          acento="azul"
          label="Unidades"
          value={String(unidadesTotal)}
          hint="Cantidad total de unidades (sillas, mesas, etc.) que coinciden con el filtro."
        />
        <StatCard
          icono={IconInventario}
          acento="ambar"
          label="Bienes registrados"
          value={String(filtrados.length)}
          hint="Cantidad de tipos de bienes distintos que coinciden con el filtro."
        />
      </div>

      <TablaSeccion
        icono={IconInventario}
        acento="cian"
        titulo="Bienes del local"
        descripcion="El estado se puede cambiar directamente desde la lista."
        filtros={
          <>
            <FiltroChip activo={filtroEstado === "TODOS"} acento="cian" onClick={() => setFiltroEstado("TODOS")}>
              Todos
            </FiltroChip>
            {ESTADOS.map((e) => (
              <FiltroChip key={e} activo={filtroEstado === e} acento="cian" onClick={() => setFiltroEstado(e)}>
                {e === "BUENO" ? "Bueno" : e === "REGULAR" ? "Regular" : e === "MALO" ? "Malo" : "Baja"}
              </FiltroChip>
            ))}
            <FiltroBusqueda value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre o categoría…" />
          </>
        }
      >
        <ul className="divide-y divide-neutral-100">
          {filtrados.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3">
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">{a.nombre}</p>
                <p className="text-xs text-neutral-500">
                  {a.categoria ?? "Sin categoría"} · {a.cantidad} unidad{a.cantidad === 1 ? "" : "es"}
                  {a.valorUnitario
                    ? ` · Bs ${formatBs(a.valorUnitario)} c/u · Bs ${formatBs(a.valorUnitario * a.cantidad)} total`
                    : ""}
                </p>
              </div>
              <select
                value={a.estado}
                onChange={(e) => cambiarEstado(a, e.target.value as EstadoActivoInventario)}
                className={`shrink-0 rounded-full border-0 px-2.5 py-1 text-xs font-semibold ${ESTADO_COLOR[a.estado]}`}
              >
                <option value="BUENO">Bueno</option>
                <option value="REGULAR">Regular</option>
                <option value="MALO">Malo</option>
                <option value="BAJA">Baja</option>
              </select>
            </li>
          ))}
          {filtrados.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-400">
              {activos.length === 0 ? "No hay bienes registrados todavía." : "Ningún bien coincide con el filtro."}
            </p>
          )}
        </ul>
      </TablaSeccion>

      {modalAbierto && (
        <ActivoModal token={token} onCerrar={() => setModalAbierto(false)} onCreado={() => { setModalAbierto(false); cargar(); }} />
      )}
    </div>
  );
}

function ActivoModal({ token, onCerrar, onCreado }: { token: string | null; onCerrar: () => void; onCreado: () => void }) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const valorUnitario = String(form.get("valorUnitario") ?? "").trim();
    try {
      await apiFetch("/inventario", token, {
        method: "POST",
        body: JSON.stringify({
          nombre: form.get("nombre"),
          categoria: String(form.get("categoria") ?? "").trim() || undefined,
          cantidad: Number(form.get("cantidad")) || 1,
          valorUnitario: valorUnitario ? Number(valorUnitario) : undefined,
        }),
      });
      onCreado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el bien");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Nuevo bien del local" onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <IconInput icon={IconInventario} name="nombre" placeholder="Nombre (ej. Silla plástica)" required autoFocus />
        <IconInput icon={IconTag} name="categoria" placeholder="Categoría (ej. mobiliario, electrónica)" />
        <div className="grid grid-cols-2 gap-2">
          <input
            name="cantidad"
            type="number"
            min="1"
            defaultValue="1"
            placeholder="Cantidad"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            name="valorUnitario"
            type="number"
            min="0"
            step="0.01"
            placeholder="Valor c/u (opcional)"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
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
