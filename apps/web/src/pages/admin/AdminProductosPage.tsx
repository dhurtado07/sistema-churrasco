import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import type { Extra, Insumo, Producto, RecetaItem } from "shared";
import { SOCKET_EVENTS } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { useSocket } from "../../lib/socketContext";
import { resizeImageToDataUrl } from "../../lib/image";
import { formatBs } from "../../lib/format";
import { Modal } from "../../components/Modal";
import { IconInput } from "../../components/IconInput";
import { Campo } from "../../components/Campo";
import {
  IconAlerta,
  IconCamera,
  IconCheck,
  IconCoin,
  IconEdit,
  IconFolder,
  IconPlus,
  IconPower,
  IconTag,
  IconTrash,
} from "../../components/icons";
import { ImagenProducto } from "../../components/ImagenProducto";
import { ConfirmActionModal } from "../../components/ConfirmActionModal";
import { Tabs } from "../../components/Tabs";
import { NuevoInsumoModal } from "./AdminInsumosPage";

type ItemMenu = { tipo: "producto"; item: Producto } | { tipo: "extra"; item: Extra };

// Mismo criterio que Caja: Platos primero, Bebidas después (son las pestañas
// que más se usan) — cualquier categoría nueva que se cree cae al final, en
// el orden en que aparece. "Extras" es su propia pestaña, siempre al final.
const ORDEN_CATEGORIA: Record<string, number> = { Platos: 0, Bebidas: 1 };
const TAB_EXTRAS = "Extras";

export function AdminProductosPage() {
  const { token } = useAuth();
  const socket = useSocket();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [modalProductoAbierto, setModalProductoAbierto] = useState(false);
  const [modalExtraAbierto, setModalExtraAbierto] = useState(false);
  const [productoReceta, setProductoReceta] = useState<Producto | null>(null);
  const [editandoProducto, setEditandoProducto] = useState<Producto | null>(null);
  const [editandoExtra, setEditandoExtra] = useState<Extra | null>(null);
  const [confirmacionToggle, setConfirmacionToggle] = useState<ItemMenu | null>(null);
  const [guardandoToggle, setGuardandoToggle] = useState(false);
  const [errorToggle, setErrorToggle] = useState<string | null>(null);
  const [confirmacionEliminar, setConfirmacionEliminar] = useState<ItemMenu | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  // Categorías ya en uso — para elegir de una lista en vez de escribirla a
  // mano cada vez (evita "Bebidas" y "bebidas" separándose en dos pestañas
  // distintas en Caja por una diferencia de mayúsculas).
  const categoriasExistentes = useMemo(
    () => [...new Set(productos.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b)),
    [productos],
  );

  // Misma idea que las pestañas de Caja: una por categoría (Platos, Bebidas,
  // la que sea) + Extras al final — para no mezclar todo en una lista larga
  // a medida que crece el menú.
  const productosPorCategoria = useMemo(() => {
    const grupos = new Map<string, Producto[]>();
    for (const producto of productos) {
      const lista = grupos.get(producto.categoria) ?? [];
      lista.push(producto);
      grupos.set(producto.categoria, lista);
    }
    return [...grupos.entries()].sort((a, b) => (ORDEN_CATEGORIA[a[0]] ?? 99) - (ORDEN_CATEGORIA[b[0]] ?? 99));
  }, [productos]);

  const tabs = useMemo(() => [...productosPorCategoria.map(([categoria]) => categoria), TAB_EXTRAS], [productosPorCategoria]);
  const [tab, setTab] = useState<string>("Platos");
  const tabActiva = tabs.includes(tab) ? tab : (tabs[0] ?? TAB_EXTRAS);
  const productosDeLaTab = productosPorCategoria.find(([categoria]) => categoria === tabActiva)?.[1] ?? [];

  function cargarMenu() {
    apiFetch<{ productos: Producto[]; extras: Extra[] }>("/admin/menu", token).then((data) => {
      setProductos(data.productos);
      setExtras(data.extras);
    });
  }

  useEffect(() => {
    cargarMenu();
    apiFetch<Insumo[]>("/insumos?activos=true", token).then(setInsumos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!socket) return;
    // El aviso en vivo trae las fotos como enlace (liviano, para Caja); acá
    // hacen falta completas porque al editar un producto se vuelven a
    // guardar, así que se recarga desde /admin/menu.
    const onMenu = () => cargarMenu();
    socket.on(SOCKET_EVENTS.MENU_ACTUALIZADO, onMenu);
    return () => {
      socket.off(SOCKET_EVENTS.MENU_ACTUALIZADO, onMenu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  async function confirmarToggle() {
    if (!confirmacionToggle) return;
    setGuardandoToggle(true);
    setErrorToggle(null);
    try {
      const { tipo, item } = confirmacionToggle;
      const ruta = tipo === "producto" ? `/admin/productos/${item.id}` : `/admin/extras/${item.id}`;
      await apiFetch(ruta, token, { method: "PATCH", body: JSON.stringify({ activo: !item.activo }) });
      setConfirmacionToggle(null);
      // El cambio llega solo por WebSocket (menu:actualizado) a todas las pantallas conectadas.
    } catch (err) {
      setErrorToggle(err instanceof ApiError ? err.message : "No se pudo cambiar el estado");
    } finally {
      setGuardandoToggle(false);
    }
  }

  async function confirmarEliminar() {
    if (!confirmacionEliminar) return;
    setEliminando(true);
    setErrorEliminar(null);
    try {
      const { tipo, item } = confirmacionEliminar;
      const ruta = tipo === "producto" ? `/admin/productos/${item.id}` : `/admin/extras/${item.id}`;
      await apiFetch(ruta, token, { method: "DELETE" });
      setConfirmacionEliminar(null);
      // El cambio llega solo por WebSocket (menu:actualizado) a todas las pantallas conectadas.
    } catch (err) {
      setErrorEliminar(err instanceof ApiError ? err.message : "No se pudo eliminar");
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <h1 className="text-lg font-semibold text-neutral-900">Productos del menú</h1>

      <Tabs value={tabActiva} onChange={setTab} tabs={tabs.map((t) => ({ value: t, label: t }))} />

      {tabActiva !== TAB_EXTRAS && (
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {tabActiva}
          </h2>
          <button
            onClick={() => setModalProductoAbierto(true)}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
          >
            <IconPlus width={14} height={14} />
            Nuevo producto
          </button>
        </div>

        <ul className="divide-y divide-neutral-100">
          {productosDeLaTab.map((producto) => (
            <li key={producto.id} className="flex items-center gap-3 py-2">
              <ImagenProducto
                imagenUrl={producto.imagenUrl}
                nombre={producto.nombre}
                categoria={producto.categoria}
                className="h-12 w-12 shrink-0 rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${producto.activo ? "text-neutral-900" : "text-neutral-400 line-through"}`}>
                  {producto.nombre}
                </p>
                <p className="text-xs text-neutral-500">
                  {producto.categoria} · Bs {formatBs(producto.precio)}
                  {producto.requiereParrilla ? " · parrilla" : ""}
                </p>
                {producto.descripcion && (
                  <p className="mt-0.5 text-xs text-neutral-400">{producto.descripcion}</p>
                )}
              </div>
              <button
                onClick={() => setProductoReceta(producto)}
                title="Definir qué insumos consume este producto (para descontar stock automático)"
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium"
              >
                <IconAlerta width={14} height={14} />
                Receta
              </button>
              <button
                onClick={() => setEditandoProducto(producto)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium"
              >
                <IconEdit width={14} height={14} />
                Editar
              </button>
              <button
                onClick={() => setConfirmacionToggle({ tipo: "producto", item: producto })}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium"
              >
                <IconPower width={14} height={14} />
                {producto.activo ? "Desactivar" : "Activar"}
              </button>
              <button
                onClick={() => setConfirmacionEliminar({ tipo: "producto", item: producto })}
                title="Eliminar del catálogo (solo si nunca se vendió)"
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
              >
                <IconTrash width={14} height={14} />
                Eliminar
              </button>
            </li>
          ))}
          {productosDeLaTab.length === 0 && (
            <p className="py-2 text-sm text-neutral-400">Sin productos todavía en "{tabActiva}".</p>
          )}
        </ul>
      </section>
      )}

      {tabActiva === TAB_EXTRAS && (
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Extras</h2>
          <button
            onClick={() => setModalExtraAbierto(true)}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
          >
            <IconPlus width={14} height={14} />
            Nuevo extra
          </button>
        </div>

        <ul className="divide-y divide-neutral-100">
          {extras.map((extra) => (
            <li key={extra.id} className="flex items-center gap-3 py-2">
              <ImagenProducto
                imagenUrl={extra.imagenUrl}
                nombre={extra.nombre}
                className="h-12 w-12 shrink-0 rounded-lg"
              />
              <p className={`flex-1 font-medium ${extra.activo ? "text-neutral-900" : "text-neutral-400 line-through"}`}>
                {extra.nombre} · Bs {formatBs(extra.precio)}
              </p>
              <button
                onClick={() => setEditandoExtra(extra)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium"
              >
                <IconEdit width={14} height={14} />
                Editar
              </button>
              <button
                onClick={() => setConfirmacionToggle({ tipo: "extra", item: extra })}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium"
              >
                <IconPower width={14} height={14} />
                {extra.activo ? "Desactivar" : "Activar"}
              </button>
              <button
                onClick={() => setConfirmacionEliminar({ tipo: "extra", item: extra })}
                title="Eliminar del catálogo (solo si nunca se vendió)"
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
              >
                <IconTrash width={14} height={14} />
                Eliminar
              </button>
            </li>
          ))}
          {extras.length === 0 && <p className="py-2 text-sm text-neutral-400">Sin extras todavía.</p>}
        </ul>
      </section>
      )}

      {modalProductoAbierto && (
        <ProductoModal
          token={token}
          categoriasExistentes={categoriasExistentes}
          categoriaInicial={tabActiva !== TAB_EXTRAS ? tabActiva : undefined}
          onCerrar={() => setModalProductoAbierto(false)}
        />
      )}
      {modalExtraAbierto && <ExtraModal token={token} onCerrar={() => setModalExtraAbierto(false)} />}
      {productoReceta && (
        <RecetaModal
          token={token}
          producto={productoReceta}
          insumos={insumos}
          onInsumoCreado={(insumo) => setInsumos((prev) => [...prev, insumo])}
          onCerrar={() => setProductoReceta(null)}
        />
      )}
      {confirmacionToggle && (
        <ConfirmActionModal
          titulo={
            confirmacionToggle.item.activo
              ? `Desactivar ${confirmacionToggle.tipo === "producto" ? "producto" : "extra"}`
              : `Activar ${confirmacionToggle.tipo === "producto" ? "producto" : "extra"}`
          }
          mensaje={
            confirmacionToggle.item.activo ? (
              <>
                ¿Desactivar <strong>"{confirmacionToggle.item.nombre}"</strong>? Deja de aparecer en el menú de Caja
                y en el menú público — no se borra, se puede reactivar cuando quieras.
              </>
            ) : (
              <>
                ¿Activar <strong>"{confirmacionToggle.item.nombre}"</strong>? Vuelve a aparecer en el menú de Caja y
                en el menú público.
              </>
            )
          }
          textoConfirmar={confirmacionToggle.item.activo ? "Sí, desactivar" : "Sí, activar"}
          tono={confirmacionToggle.item.activo ? "red" : "green"}
          cargando={guardandoToggle}
          error={errorToggle}
          onConfirmar={confirmarToggle}
          onCancelar={() => setConfirmacionToggle(null)}
        />
      )}
      {editandoProducto && (
        <EditarProductoModal
          token={token}
          producto={editandoProducto}
          categoriasExistentes={categoriasExistentes}
          onCerrar={() => setEditandoProducto(null)}
        />
      )}
      {editandoExtra && (
        <EditarExtraModal token={token} extra={editandoExtra} onCerrar={() => setEditandoExtra(null)} />
      )}
      {confirmacionEliminar && (
        <ConfirmActionModal
          titulo={`Eliminar ${confirmacionEliminar.tipo === "producto" ? "producto" : "extra"}`}
          mensaje={
            <>
              ¿Eliminar <strong>"{confirmacionEliminar.item.nombre}"</strong> del catálogo? Esto no se puede
              deshacer. Si ya se vendió alguna vez, el sistema va a rechazar el borrado para no perder ese historial
              — en ese caso usá "Desactivar" en su lugar.
            </>
          }
          textoConfirmar="Sí, eliminar"
          tono="red"
          cargando={eliminando}
          error={errorEliminar}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setConfirmacionEliminar(null)}
        />
      )}
    </div>
  );
}

function RecetaModal({
  token,
  producto,
  insumos,
  onInsumoCreado,
  onCerrar,
}: {
  token: string | null;
  producto: Producto;
  insumos: Insumo[];
  onInsumoCreado: (insumo: Insumo) => void;
  onCerrar: () => void;
}) {
  const [items, setItems] = useState<RecetaItem[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalNuevoInsumo, setModalNuevoInsumo] = useState(false);

  useEffect(() => {
    apiFetch<RecetaItem[]>(`/admin/productos/${producto.id}/receta`, token)
      .then(setItems)
      .catch(() => setError("No se pudo cargar la receta"));
  }, [producto.id, token]);

  function agregarFilaCon(insumo: Insumo) {
    setItems((prev) => [
      ...(prev ?? []),
      { insumoId: insumo.id, insumoNombre: insumo.nombre, unidad: insumo.unidad, cantidadPorUnidad: 0 },
    ]);
  }

  function agregarFila() {
    const disponible = insumos.find((i) => !items?.some((it) => it.insumoId === i.id));
    if (!disponible) return;
    agregarFilaCon(disponible);
  }

  function onNuevoInsumoCreado(insumo: Insumo) {
    onInsumoCreado(insumo);
    agregarFilaCon(insumo);
    setModalNuevoInsumo(false);
  }

  function cambiarInsumo(index: number, insumoId: string) {
    const insumo = insumos.find((i) => i.id === insumoId);
    if (!insumo) return;
    setItems((prev) =>
      (prev ?? []).map((it, i) => (i === index ? { ...it, insumoId, insumoNombre: insumo.nombre, unidad: insumo.unidad } : it)),
    );
  }

  function cambiarCantidad(index: number, cantidadPorUnidad: number) {
    setItems((prev) => (prev ?? []).map((it, i) => (i === index ? { ...it, cantidadPorUnidad } : it)));
  }

  function quitarFila(index: number) {
    setItems((prev) => (prev ?? []).filter((_, i) => i !== index));
  }

  async function guardar() {
    if (!items) return;
    setGuardando(true);
    setError(null);
    setGuardado(false);
    try {
      await apiFetch(`/admin/productos/${producto.id}/receta`, token, {
        method: "PUT",
        body: JSON.stringify({
          items: items.map((i) => ({ insumoId: i.insumoId, cantidadPorUnidad: i.cantidadPorUnidad })),
        }),
      });
      setGuardado(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la receta");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={`Receta de "${producto.nombre}"`} onCerrar={onCerrar}>
      <p className="mb-3 text-xs text-neutral-500">
        Cuánto de cada insumo consume <strong>una unidad</strong> vendida de este producto — se descuenta del stock
        automáticamente en cada venta. Sin receta, este producto no descuenta ningún insumo.
      </p>

      {items === null && !error && <p className="text-sm text-neutral-400">Cargando…</p>}

      {items && (
        <div className="space-y-2">
          {items.length > 0 && (
            <div className="flex items-center gap-2 px-0.5">
              <span className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Insumo</span>
              <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-neutral-500">Cantidad</span>
              <span className="w-14 shrink-0 text-xs font-semibold uppercase tracking-wide text-neutral-500">Unidad</span>
              <span className="w-4 shrink-0" />
            </div>
          )}
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                value={item.insumoId}
                onChange={(e) => cambiarInsumo(index, e.target.value)}
                title="Insumo"
                className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-2 py-2 text-sm"
              >
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.001"
                value={item.cantidadPorUnidad}
                onChange={(e) => cambiarCantidad(index, Number(e.target.value))}
                title="Cantidad por unidad vendida"
                className="w-24 rounded-lg border border-neutral-300 px-2 py-2 text-sm"
              />
              <span className="w-14 shrink-0 text-xs text-neutral-500">{item.unidad}</span>
              <button type="button" onClick={() => quitarFila(index)} className="shrink-0 text-red-600" title="Quitar de la receta">
                <IconTrash width={16} height={16} />
              </button>
            </div>
          ))}

          {items.length === 0 && <p className="text-sm text-neutral-400">Sin insumos en la receta todavía.</p>}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <button
              type="button"
              onClick={agregarFila}
              disabled={insumos.length === 0 || items.length >= insumos.length}
              className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 disabled:opacity-40"
            >
              <IconPlus width={14} height={14} />
              Agregar insumo del catálogo
            </button>
            <button
              type="button"
              onClick={() => setModalNuevoInsumo(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600"
            >
              <IconPlus width={14} height={14} />
              Registrar insumo nuevo
            </button>
          </div>

          {insumos.length === 0 && (
            <p className="text-xs text-amber-600">
              Todavía no hay insumos en el catálogo — usá "Registrar insumo nuevo" arriba para crear el primero.
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {guardado && <p className="text-sm text-emerald-600">Receta guardada ✓</p>}

          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            <IconCheck width={16} height={16} />
            {guardando ? "Guardando…" : "Guardar receta"}
          </button>
        </div>
      )}

      {modalNuevoInsumo && (
        <NuevoInsumoModal token={token} onCerrar={() => setModalNuevoInsumo(false)} onCreado={onNuevoInsumoCreado} />
      )}
    </Modal>
  );
}

function ImagenPicker({
  imagenPreview,
  onImagenSeleccionada,
}: {
  imagenPreview: string | null;
  onImagenSeleccionada: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-neutral-400">
        {imagenPreview ? (
          <img src={imagenPreview} alt="Vista previa" className="h-full w-full object-cover" />
        ) : (
          <IconCamera width={22} height={22} />
        )}
        <input type="file" accept="image/*" className="hidden" onChange={onImagenSeleccionada} />
      </label>
      <p className="text-xs text-neutral-500">Opcional. Se redimensiona automáticamente.</p>
    </div>
  );
}

/** Selector de categoría: elegir una ya existente de una lista, o escribir
 * una nueva — en vez de un texto libre siempre, que termina duplicando
 * categorías por una diferencia de mayúsculas ("Bebidas" vs "bebidas") y las
 * separa en pestañas distintas en Caja y el menú público. */
function SelectorCategoria({
  categoriasExistentes,
  valorInicial,
}: {
  categoriasExistentes: string[];
  valorInicial?: string;
}) {
  const [escribirNueva, setEscribirNueva] = useState(categoriasExistentes.length === 0);

  if (escribirNueva) {
    return (
      <div className="flex gap-2">
        <IconInput
          icon={IconFolder}
          name="categoria"
          placeholder="Nombre de la categoría (ej. Platos, Bebidas)"
          defaultValue={valorInicial ?? ""}
          required
          autoFocus
          className="flex-1"
        />
        {categoriasExistentes.length > 0 && (
          <button
            type="button"
            onClick={() => setEscribirNueva(false)}
            className="shrink-0 rounded-lg bg-neutral-100 px-3 text-xs font-medium text-neutral-600"
          >
            Elegir existente
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      name="categoria"
      defaultValue={valorInicial ?? categoriasExistentes[0]}
      onChange={(e) => {
        if (e.target.value === "__nueva__") setEscribirNueva(true);
      }}
      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      required
    >
      {categoriasExistentes.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      <option value="__nueva__">+ Nueva categoría…</option>
    </select>
  );
}

function ProductoModal({
  token,
  categoriasExistentes,
  categoriaInicial,
  onCerrar,
}: {
  token: string | null;
  categoriasExistentes: string[];
  categoriaInicial?: string;
  onCerrar: () => void;
}) {
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onImagenSeleccionada(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setImagenPreview(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar la imagen");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/admin/productos", token, {
        method: "POST",
        body: JSON.stringify({
          nombre: form.get("nombre"),
          categoria: form.get("categoria"),
          descripcion: String(form.get("descripcion") ?? "").trim() || null,
          precio: Number(form.get("precio")),
          requiereParrilla: form.get("requiereParrilla") === "on",
          imagenUrl: imagenPreview ?? undefined,
        }),
      });
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el producto");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Nuevo producto" onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <ImagenPicker imagenPreview={imagenPreview} onImagenSeleccionada={onImagenSeleccionada} />

        <Campo etiqueta="Nombre">
          <IconInput icon={IconTag} name="nombre" placeholder="Ej. Churrasco Sencillo" required />
        </Campo>
        <Campo etiqueta="Categoría">
          <SelectorCategoria categoriasExistentes={categoriasExistentes} valorInicial={categoriaInicial} />
        </Campo>
        <Campo etiqueta="Descripción (opcional)">
          <textarea
            name="descripcion"
            rows={2}
            placeholder="Ej. Viene con ensalada, papa y arroz"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </Campo>
        <Campo etiqueta="Precio (Bs)">
          <IconInput icon={IconCoin} name="precio" type="number" step="0.01" min="0" placeholder="0.00" required />
        </Campo>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input type="checkbox" name="requiereParrilla" defaultChecked /> Requiere parrilla
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={guardando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <IconCheck width={16} height={16} />
          {guardando ? "Guardando…" : "Crear producto"}
        </button>
      </form>
    </Modal>
  );
}

function EditarProductoModal({
  token,
  producto,
  categoriasExistentes,
  onCerrar,
}: {
  token: string | null;
  producto: Producto;
  categoriasExistentes: string[];
  onCerrar: () => void;
}) {
  const [imagenPreview, setImagenPreview] = useState<string | null>(producto.imagenUrl);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onImagenSeleccionada(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setImagenPreview(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar la imagen");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch(`/admin/productos/${producto.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          nombre: form.get("nombre"),
          categoria: form.get("categoria"),
          descripcion: String(form.get("descripcion") ?? "").trim() || null,
          precio: Number(form.get("precio")),
          requiereParrilla: form.get("requiereParrilla") === "on",
          imagenUrl: imagenPreview ?? undefined,
        }),
      });
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el producto");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={`Editar "${producto.nombre}"`} onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <ImagenPicker imagenPreview={imagenPreview} onImagenSeleccionada={onImagenSeleccionada} />

        <Campo etiqueta="Nombre">
          <IconInput icon={IconTag} name="nombre" defaultValue={producto.nombre} required />
        </Campo>
        <Campo etiqueta="Categoría">
          <SelectorCategoria categoriasExistentes={categoriasExistentes} valorInicial={producto.categoria} />
        </Campo>
        <Campo etiqueta="Descripción (opcional)">
          <textarea
            name="descripcion"
            rows={2}
            placeholder="Ej. Viene con ensalada, papa y arroz"
            defaultValue={producto.descripcion ?? ""}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </Campo>
        <Campo etiqueta="Precio (Bs)">
          <IconInput icon={IconCoin} name="precio" type="number" step="0.01" min="0" defaultValue={producto.precio} required />
        </Campo>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input type="checkbox" name="requiereParrilla" defaultChecked={producto.requiereParrilla} /> Requiere parrilla
        </label>

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

function ExtraModal({ token, onCerrar }: { token: string | null; onCerrar: () => void }) {
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onImagenSeleccionada(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setImagenPreview(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar la imagen");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/admin/extras", token, {
        method: "POST",
        body: JSON.stringify({
          nombre: form.get("nombre"),
          precio: Number(form.get("precio")),
          imagenUrl: imagenPreview ?? undefined,
        }),
      });
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el extra");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Nuevo extra" onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <ImagenPicker imagenPreview={imagenPreview} onImagenSeleccionada={onImagenSeleccionada} />

        <Campo etiqueta="Nombre">
          <IconInput icon={IconTag} name="nombre" placeholder="Ej. Arroz" required />
        </Campo>
        <Campo etiqueta="Precio (Bs)">
          <IconInput icon={IconCoin} name="precio" type="number" step="0.01" min="0" placeholder="0.00" required />
        </Campo>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={guardando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <IconCheck width={16} height={16} />
          {guardando ? "Guardando…" : "Crear extra"}
        </button>
      </form>
    </Modal>
  );
}

function EditarExtraModal({ token, extra, onCerrar }: { token: string | null; extra: Extra; onCerrar: () => void }) {
  const [imagenPreview, setImagenPreview] = useState<string | null>(extra.imagenUrl);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onImagenSeleccionada(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setImagenPreview(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar la imagen");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch(`/admin/extras/${extra.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          nombre: form.get("nombre"),
          precio: Number(form.get("precio")),
          imagenUrl: imagenPreview ?? undefined,
        }),
      });
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el extra");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={`Editar "${extra.nombre}"`} onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <ImagenPicker imagenPreview={imagenPreview} onImagenSeleccionada={onImagenSeleccionada} />

        <Campo etiqueta="Nombre">
          <IconInput icon={IconTag} name="nombre" defaultValue={extra.nombre} required />
        </Campo>
        <Campo etiqueta="Precio (Bs)">
          <IconInput icon={IconCoin} name="precio" type="number" step="0.01" min="0" defaultValue={extra.precio} required />
        </Campo>

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
