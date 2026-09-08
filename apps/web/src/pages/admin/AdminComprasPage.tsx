import { useEffect, useMemo, useState } from "react";
import type { Compra, Insumo, Proveedor } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { formatBs } from "../../lib/format";
import { Modal } from "../../components/Modal";
import { IconInput } from "../../components/IconInput";
import { IconCheck, IconCompra, IconPlus, IconTrash } from "../../components/icons";
import { StatCard } from "../../components/StatCard";
import { TablaSeccion, FiltroBusqueda } from "../../components/TablaSeccion";

// insumoId vacío = compra "suelta" sin control de stock (texto libre, igual
// que antes de tener el catálogo de insumos).
interface ItemBorrador {
  insumoId: string;
  insumo: string;
  categoria: string;
  cantidad: string;
  unidad: string;
  precioUnitario: string;
}

const ITEM_VACIO: ItemBorrador = { insumoId: "", insumo: "", categoria: "", cantidad: "1", unidad: "kg", precioUnitario: "" };

function formatoFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function AdminComprasPage() {
  const { token } = useAuth();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  async function cargar() {
    const params = new URLSearchParams();
    if (proveedorId) params.set("proveedorId", proveedorId);
    if (filtroDesde) params.set("desde", new Date(`${filtroDesde}T00:00:00`).toISOString());
    if (filtroHasta) params.set("hasta", new Date(`${filtroHasta}T23:59:59`).toISOString());
    const [c, p, i] = await Promise.all([
      apiFetch<Compra[]>(`/compras?${params.toString()}`, token),
      apiFetch<Proveedor[]>("/proveedores?activos=true", token),
      apiFetch<Insumo[]>("/insumos?activos=true", token),
    ]);
    setCompras(c);
    setProveedores(p);
    setInsumos(i);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, proveedorId, filtroDesde, filtroHasta]);

  const comprasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return compras;
    return compras.filter(
      (c) =>
        (c.proveedorNombre ?? "").toLowerCase().includes(termino) ||
        c.items.some((i) => i.insumo.toLowerCase().includes(termino)),
    );
  }, [compras, busqueda]);

  const totalInvertido = comprasFiltradas.reduce((sum, c) => sum + c.total, 0);
  const cantidadInsumos = comprasFiltradas.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Compras</h1>
          <p className="text-xs text-neutral-500">La inversión en insumos (arroz, papa, carne, verduras), separada de las ventas.</p>
        </div>
        <button
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
        >
          <IconPlus width={14} height={14} />
          Registrar compra
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          icono={IconCompra}
          acento="naranja"
          label="Invertido en este filtro"
          value={`Bs ${formatBs(totalInvertido)}`}
          hint="Suma de todas las compras que coinciden con los filtros de abajo."
        />
        <StatCard
          icono={IconCompra}
          acento="ambar"
          label="Compras"
          value={String(comprasFiltradas.length)}
          hint="Cantidad de compras registradas que coinciden con los filtros."
        />
        <StatCard
          icono={IconCompra}
          acento="violeta"
          label="Insumos distintos"
          value={String(cantidadInsumos)}
          hint="Cantidad de líneas de insumo (no de compras) incluidas en este filtro."
        />
      </div>

      <TablaSeccion
        icono={IconCompra}
        acento="naranja"
        titulo="Historial de compras"
        descripcion="Cada compra genera automáticamente su egreso en el libro de caja, categorizado como insumos."
        filtros={
          <>
            <FiltroBusqueda value={busqueda} onChange={setBusqueda} placeholder="Buscar por proveedor o insumo…" />
            <select
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
            >
              <option value="">Todos los proveedores</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
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
            </div>
          </>
        }
      >
        <ul className="divide-y divide-neutral-100">
          {comprasFiltradas.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3">
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">{c.proveedorNombre ?? "Sin proveedor"}</p>
                <p className="text-xs text-neutral-500">{formatoFecha(c.fecha)} · {c.registradoPorNombre}</p>
                <p className="mt-1 text-xs text-neutral-600">
                  {c.items.map((i) => `${i.cantidad} ${i.unidad} ${i.insumo}`).join(", ")}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-red-600">Bs {formatBs(c.total)}</span>
            </li>
          ))}
          {comprasFiltradas.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-400">
              {compras.length === 0 ? "No hay compras registradas todavía." : "Ninguna compra coincide con el filtro."}
            </p>
          )}
        </ul>
      </TablaSeccion>

      {modalAbierto && (
        <CompraModal
          token={token}
          proveedores={proveedores}
          insumos={insumos}
          onCerrar={() => setModalAbierto(false)}
          onCreada={() => {
            setModalAbierto(false);
            cargar();
          }}
        />
      )}
    </div>
  );
}

function CompraModal({
  token,
  proveedores,
  insumos,
  onCerrar,
  onCreada,
}: {
  token: string | null;
  proveedores: Proveedor[];
  insumos: Insumo[];
  onCerrar: () => void;
  onCreada: () => void;
}) {
  const [proveedorId, setProveedorId] = useState("");
  const [items, setItems] = useState<ItemBorrador[]>([{ ...ITEM_VACIO }]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function actualizarItem(index: number, campo: keyof ItemBorrador, valor: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [campo]: valor } : item)));
  }

  /** Elegir un insumo del catálogo autocompleta nombre/unidad y los deja fijos
   * (para que la compra realmente reponga el stock de ESE insumo, en su
   * unidad) — elegir "Insumo suelto" vuelve a los campos de texto libre de
   * siempre, sin control de stock. */
  function elegirInsumo(index: number, insumoId: string) {
    const insumo = insumos.find((i) => i.id === insumoId);
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, insumoId, insumo: insumo?.nombre ?? "", unidad: insumo?.unidad ?? item.unidad, categoria: insumo?.categoria ?? item.categoria }
          : item,
      ),
    );
  }

  const total = items.reduce((sum, item) => sum + (Number(item.cantidad) || 0) * (Number(item.precioUnitario) || 0), 0);

  async function onSubmit() {
    setGuardando(true);
    setError(null);
    try {
      await apiFetch("/compras", token, {
        method: "POST",
        body: JSON.stringify({
          proveedorId: proveedorId || undefined,
          items: items
            .filter((i) => i.insumo.trim())
            .map((i) => ({
              insumo: i.insumo.trim(),
              categoria: i.categoria.trim() || undefined,
              cantidad: Number(i.cantidad),
              unidad: i.unidad,
              precioUnitario: Number(i.precioUnitario),
              insumoId: i.insumoId || undefined,
            })),
        }),
      });
      onCreada();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar la compra");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Registrar compra" onCerrar={onCerrar}>
      <div className="space-y-3">
        <select
          value={proveedorId}
          onChange={(e) => setProveedorId(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Sin proveedor / genérico</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="rounded-lg border border-neutral-200 p-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-neutral-500">Insumo {index + 1}</p>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    className="text-red-600"
                  >
                    <IconTrash width={14} height={14} />
                  </button>
                )}
              </div>
              <select
                value={item.insumoId}
                onChange={(e) => elegirInsumo(index, e.target.value)}
                className="mb-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="">Insumo suelto (texto libre, sin control de stock)</option>
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({i.unidad})
                  </option>
                ))}
              </select>
              {!item.insumoId && (
                <IconInput
                  icon={IconCompra}
                  placeholder="Insumo (ej. arroz, papa, carne)"
                  className="mb-2"
                  value={item.insumo}
                  onChange={(e) => actualizarItem(index, "insumo", e.target.value)}
                />
              )}
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Cant."
                  value={item.cantidad}
                  onChange={(e) => actualizarItem(index, "cantidad", e.target.value)}
                  className="rounded-lg border border-neutral-300 px-2 py-2 text-sm"
                />
                <select
                  value={item.unidad}
                  onChange={(e) => actualizarItem(index, "unidad", e.target.value)}
                  disabled={Boolean(item.insumoId)}
                  title={item.insumoId ? "La unidad la define el insumo del catálogo" : undefined}
                  className="rounded-lg border border-neutral-300 px-2 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-400"
                >
                  <option value="kg">kg</option>
                  <option value="unidad">unidad</option>
                  <option value="litro">litro</option>
                  <option value="paquete">paquete</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Precio c/u"
                  value={item.precioUnitario}
                  onChange={(e) => actualizarItem(index, "precioUnitario", e.target.value)}
                  className="rounded-lg border border-neutral-300 px-2 py-2 text-sm"
                />
              </div>
              {item.insumoId && (
                <p className="mt-1.5 text-xs text-emerald-600">✓ Repondrá stock de este insumo al confirmar.</p>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, { ...ITEM_VACIO }])}
          className="flex items-center gap-1.5 text-xs font-medium text-neutral-600"
        >
          <IconPlus width={14} height={14} />
          Agregar otro insumo
        </button>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-2 text-base font-bold">
          <span>Total</span>
          <span>Bs {formatBs(total)}</span>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={onSubmit}
          disabled={guardando || items.every((i) => !i.insumo.trim())}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <IconCheck width={16} height={16} />
          {guardando ? "Guardando…" : "Guardar compra"}
        </button>
      </div>
    </Modal>
  );
}
