import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Insumo, UnidadInsumo } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { Modal } from "../../components/Modal";
import { IconInput } from "../../components/IconInput";
import { Campo } from "../../components/Campo";
import { IconAlerta, IconCheck, IconCompra, IconInventario, IconPlus, IconTag } from "../../components/icons";
import { StatCard } from "../../components/StatCard";
import { Badge, FilaVacia, FiltroBusqueda, FiltroChip, Paginacion, TablaSeccion, Th } from "../../components/TablaSeccion";

const UNIDADES: UnidadInsumo[] = ["kg", "litro", "unidad", "paquete"];

function estadoStock(i: Insumo): { tono: "rojo" | "ambar" | "verde"; etiqueta: string } {
  if (i.stockActual <= 0) return { tono: "rojo", etiqueta: "Agotado" };
  if (i.stockActual <= i.stockMinimo) return { tono: "ambar", etiqueta: "Stock bajo" };
  return { tono: "verde", etiqueta: "OK" };
}

export function AdminInsumosPage() {
  const { token } = useAuth();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"TODOS" | "BAJO" | "AGOTADO">("TODOS");
  const [modalNuevo, setModalNuevo] = useState(false);
  const [editando, setEditando] = useState<Insumo | null>(null);
  const [ajustando, setAjustando] = useState<Insumo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(25);

  async function cargar() {
    setInsumos(await apiFetch<Insumo[]>("/insumos", token));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return insumos.filter((i) => {
      if (filtroEstado === "BAJO" && !(i.stockActual > 0 && i.stockActual <= i.stockMinimo)) return false;
      if (filtroEstado === "AGOTADO" && i.stockActual > 0) return false;
      if (!termino) return true;
      return i.nombre.toLowerCase().includes(termino) || (i.categoria ?? "").toLowerCase().includes(termino);
    });
  }, [insumos, busqueda, filtroEstado]);

  const conStockBajo = insumos.filter((i) => i.stockActual > 0 && i.stockActual <= i.stockMinimo).length;
  const agotados = insumos.filter((i) => i.stockActual <= 0).length;

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtroEstado, tamano]);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamano));
  const paginados = filtrados.slice((pagina - 1) * tamano, pagina * tamano);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Insumos y stock</h1>
          <p className="text-xs text-neutral-500">
            El stock baja solo con cada venta (según la receta de cada producto, ver "Productos") y sube solo con
            cada compra linkeada. También se puede corregir a mano.
          </p>
        </div>
        <button
          onClick={() => setModalNuevo(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
        >
          <IconPlus width={14} height={14} />
          Nuevo insumo
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icono={IconInventario} acento="cian" label="Insumos" value={String(insumos.length)} hint="Total de insumos en el catálogo." />
        <StatCard
          icono={IconAlerta}
          acento="ambar"
          label="Stock bajo"
          value={String(conStockBajo)}
          hint="Insumos con stock actual por debajo (o igual) de su stock mínimo, pero todavía no en cero."
        />
        <StatCard
          icono={IconAlerta}
          acento="rojo"
          label="Agotados"
          value={String(agotados)}
          hint="Insumos con stock en cero o negativo (la venta nunca se bloquea por esto, es solo informativo)."
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <TablaSeccion
        icono={IconInventario}
        acento="cian"
        titulo="Catálogo de insumos"
        descripcion="Arroz, papa, carne, verduras, etc. — la unidad se usa tanto en compras como en recetas."
        filtros={
          <>
            <FiltroChip activo={filtroEstado === "TODOS"} acento="cian" onClick={() => setFiltroEstado("TODOS")}>
              Todos
            </FiltroChip>
            <FiltroChip activo={filtroEstado === "BAJO"} acento="ambar" onClick={() => setFiltroEstado("BAJO")}>
              Stock bajo
            </FiltroChip>
            <FiltroChip activo={filtroEstado === "AGOTADO"} acento="rojo" onClick={() => setFiltroEstado("AGOTADO")}>
              Agotados
            </FiltroChip>
            <FiltroBusqueda value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre o categoría…" />
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-neutral-100">
                <Th>Nombre</Th>
                <Th>Categoría</Th>
                <Th align="right">Stock actual</Th>
                <Th align="right" hint="Debajo de este número, el insumo pasa a 'Stock bajo'.">
                  Stock mínimo
                </Th>
                <Th align="center">Estado</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {paginados.map((i) => {
                const estado = estadoStock(i);
                return (
                  <tr key={i.id}>
                    <td className="px-3 py-2.5 text-sm font-medium text-neutral-900">
                      {i.nombre}
                      {!i.activo && <span className="ml-1.5 text-xs font-normal text-neutral-400">(inactivo)</span>}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-neutral-500">{i.categoria ?? "Sin categoría"}</td>
                    <td className="px-3 py-2.5 text-right text-sm font-semibold text-neutral-900">
                      {i.stockActual.toFixed(2)} {i.unidad}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-neutral-500">
                      {i.stockMinimo.toFixed(2)} {i.unidad}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge tono={estado.tono}>{estado.etiqueta}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setAjustando(i)}
                          className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
                        >
                          Ajustar
                        </button>
                        <button
                          onClick={() => setEditando(i)}
                          className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <FilaVacia colSpan={6}>
                  {insumos.length === 0 ? "No hay insumos registrados todavía." : "Ningún insumo coincide con el filtro."}
                </FilaVacia>
              )}
            </tbody>
          </table>
          <Paginacion
            pagina={pagina}
            totalPaginas={totalPaginas}
            totalItems={filtrados.length}
            tamano={tamano}
            onCambiarPagina={setPagina}
            onCambiarTamano={setTamano}
          />
        </div>
      </TablaSeccion>

      {modalNuevo && (
        <NuevoInsumoModal token={token} onCerrar={() => setModalNuevo(false)} onCreado={() => { setModalNuevo(false); cargar(); }} />
      )}
      {editando && (
        <EditarInsumoModal
          token={token}
          insumo={editando}
          onCerrar={() => setEditando(null)}
          onListo={() => { setEditando(null); cargar(); }}
        />
      )}
      {ajustando && (
        <AjustarStockModal
          token={token}
          insumo={ajustando}
          onCerrar={() => setAjustando(null)}
          onListo={() => { setAjustando(null); cargar(); }}
        />
      )}
    </div>
  );
}

/** Exportado para reusarlo desde la Receta de un producto (Productos):
 * ahí también hace falta poder registrar un insumo nuevo sin salir del
 * modal, en vez de mandar al admin a esta página primero. */
export function NuevoInsumoModal({
  token,
  onCerrar,
  onCreado,
}: {
  token: string | null;
  onCerrar: () => void;
  onCreado: (insumo: Insumo) => void;
}) {
  const [unidad, setUnidad] = useState<UnidadInsumo>("kg");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const insumo = await apiFetch<Insumo>("/insumos", token, {
        method: "POST",
        body: JSON.stringify({
          nombre: form.get("nombre"),
          categoria: String(form.get("categoria") ?? "").trim() || undefined,
          unidad,
          stockInicial: Number(form.get("stockInicial")) || 0,
          stockMinimo: Number(form.get("stockMinimo")) || 0,
        }),
      });
      onCreado(insumo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el insumo");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Nuevo insumo" onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Campo etiqueta="Nombre">
          <IconInput icon={IconInventario} name="nombre" placeholder="Ej. Carne de res" required autoFocus />
        </Campo>
        <Campo etiqueta="Categoría (opcional)">
          <IconInput icon={IconTag} name="categoria" placeholder="Ej. carnes, verduras" />
        </Campo>
        <Campo etiqueta="Unidad">
          <div className="grid grid-cols-4 gap-1.5">
            {UNIDADES.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnidad(u)}
                className={`rounded-lg px-2 py-2 text-xs font-medium ${unidad === u ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"}`}
              >
                {u}
              </button>
            ))}
          </div>
        </Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo etiqueta="Stock inicial">
            <IconInput icon={IconCompra} name="stockInicial" type="number" min="0" step="0.01" placeholder="0" />
          </Campo>
          <Campo etiqueta="Stock mínimo">
            <IconInput icon={IconAlerta} name="stockMinimo" type="number" min="0" step="0.01" placeholder="0" />
          </Campo>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={guardando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <IconCheck width={16} height={16} />
          {guardando ? "Creando…" : "Crear insumo"}
        </button>
      </form>
    </Modal>
  );
}

function EditarInsumoModal({
  token,
  insumo,
  onCerrar,
  onListo,
}: {
  token: string | null;
  insumo: Insumo;
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
    try {
      await apiFetch(`/insumos/${insumo.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          nombre: form.get("nombre"),
          categoria: String(form.get("categoria") ?? "").trim() || null,
          stockMinimo: Number(form.get("stockMinimo")) || 0,
          activo: form.get("activo") === "on",
        }),
      });
      onListo();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el insumo");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={`Editar "${insumo.nombre}"`} onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Campo etiqueta="Nombre">
          <IconInput icon={IconInventario} name="nombre" defaultValue={insumo.nombre} required />
        </Campo>
        <Campo etiqueta="Categoría (opcional)">
          <IconInput icon={IconTag} name="categoria" defaultValue={insumo.categoria ?? ""} placeholder="Ej. carnes, verduras" />
        </Campo>
        <Campo etiqueta="Stock mínimo">
          <IconInput icon={IconAlerta} name="stockMinimo" type="number" min="0" step="0.01" defaultValue={insumo.stockMinimo} />
        </Campo>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" name="activo" defaultChecked={insumo.activo} />
          Activo (aparece como opción en compras y recetas nuevas)
        </label>
        <p className="text-xs text-neutral-400">
          La unidad ({insumo.unidad}) no se puede cambiar acá — crealo de nuevo si necesitás otra unidad.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={guardando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <IconCheck width={16} height={16} />
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </Modal>
  );
}

function AjustarStockModal({
  token,
  insumo,
  onCerrar,
  onListo,
}: {
  token: string | null;
  insumo: Insumo;
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
    try {
      await apiFetch(`/insumos/${insumo.id}/ajustar-stock`, token, {
        method: "POST",
        body: JSON.stringify({ delta: Number(form.get("delta")), nota: form.get("nota") }),
      });
      onListo();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo ajustar el stock");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={`Ajustar stock de "${insumo.nombre}"`} onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-xs text-neutral-500">
          Stock actual: <span className="font-semibold text-neutral-900">{insumo.stockActual.toFixed(2)} {insumo.unidad}</span>.
          Ingresá cuánto sumar (positivo, ej. conteo físico encontró más) o restar (negativo, ej. merma).
        </p>
        <Campo etiqueta={`Cantidad a sumar o restar (${insumo.unidad})`}>
          <IconInput icon={IconCompra} name="delta" type="number" step="0.01" placeholder={`Ej. -2 o 5`} required autoFocus />
        </Campo>
        <Campo etiqueta="Motivo del ajuste">
          <IconInput icon={IconTag} name="nota" placeholder="Ej. merma, conteo físico" required />
        </Campo>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={guardando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <IconCheck width={16} height={16} />
          {guardando ? "Guardando…" : "Confirmar ajuste"}
        </button>
      </form>
    </Modal>
  );
}
