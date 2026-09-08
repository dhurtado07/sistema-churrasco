import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { Extra, Insumo, Producto, RecetaItem } from "shared";
import { SOCKET_EVENTS } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { useSocket } from "../../lib/socketContext";
import { resizeImageToDataUrl } from "../../lib/image";
import { formatBs } from "../../lib/format";
import { Modal } from "../../components/Modal";
import { IconInput } from "../../components/IconInput";
import { IconAlerta, IconCamera, IconCheck, IconCoin, IconFolder, IconPlus, IconPower, IconTag, IconTrash } from "../../components/icons";
import { ImagenProducto } from "../../components/ImagenProducto";
import { ConfirmActionModal } from "../../components/ConfirmActionModal";

type ConfirmacionToggle = { tipo: "producto"; item: Producto } | { tipo: "extra"; item: Extra };

export function AdminProductosPage() {
  const { token } = useAuth();
  const socket = useSocket();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [modalProductoAbierto, setModalProductoAbierto] = useState(false);
  const [modalExtraAbierto, setModalExtraAbierto] = useState(false);
  const [productoReceta, setProductoReceta] = useState<Producto | null>(null);
  const [confirmacionToggle, setConfirmacionToggle] = useState<ConfirmacionToggle | null>(null);
  const [guardandoToggle, setGuardandoToggle] = useState(false);
  const [errorToggle, setErrorToggle] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ productos: Producto[]; extras: Extra[] }>("/admin/menu", token).then((data) => {
      setProductos(data.productos);
      setExtras(data.extras);
    });
    apiFetch<Insumo[]>("/insumos?activos=true", token).then(setInsumos);
  }, [token]);

  useEffect(() => {
    if (!socket) return;
    const onMenu = (payload: { productos: Producto[]; extras: Extra[] }) => {
      setProductos(payload.productos);
      setExtras(payload.extras);
    };
    socket.on(SOCKET_EVENTS.MENU_ACTUALIZADO, onMenu);
    return () => {
      socket.off(SOCKET_EVENTS.MENU_ACTUALIZADO, onMenu);
    };
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

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <h1 className="text-lg font-semibold text-neutral-900">Productos del menú</h1>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Productos
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
          {productos.map((producto) => (
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
                onClick={() => setConfirmacionToggle({ tipo: "producto", item: producto })}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium"
              >
                <IconPower width={14} height={14} />
                {producto.activo ? "Desactivar" : "Activar"}
              </button>
            </li>
          ))}
          {productos.length === 0 && <p className="py-2 text-sm text-neutral-400">Sin productos todavía.</p>}
        </ul>
      </section>

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
                onClick={() => setConfirmacionToggle({ tipo: "extra", item: extra })}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium"
              >
                <IconPower width={14} height={14} />
                {extra.activo ? "Desactivar" : "Activar"}
              </button>
            </li>
          ))}
          {extras.length === 0 && <p className="py-2 text-sm text-neutral-400">Sin extras todavía.</p>}
        </ul>
      </section>

      {modalProductoAbierto && (
        <ProductoModal token={token} onCerrar={() => setModalProductoAbierto(false)} />
      )}
      {modalExtraAbierto && <ExtraModal token={token} onCerrar={() => setModalExtraAbierto(false)} />}
      {productoReceta && (
        <RecetaModal
          token={token}
          producto={productoReceta}
          insumos={insumos}
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
    </div>
  );
}

function RecetaModal({
  token,
  producto,
  insumos,
  onCerrar,
}: {
  token: string | null;
  producto: Producto;
  insumos: Insumo[];
  onCerrar: () => void;
}) {
  const [items, setItems] = useState<RecetaItem[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<RecetaItem[]>(`/admin/productos/${producto.id}/receta`, token)
      .then(setItems)
      .catch(() => setError("No se pudo cargar la receta"));
  }, [producto.id, token]);

  function agregarFila() {
    const disponible = insumos.find((i) => !items?.some((it) => it.insumoId === i.id));
    if (!disponible) return;
    setItems((prev) => [
      ...(prev ?? []),
      { insumoId: disponible.id, insumoNombre: disponible.nombre, unidad: disponible.unidad, cantidadPorUnidad: 0 },
    ]);
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
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                value={item.insumoId}
                onChange={(e) => cambiarInsumo(index, e.target.value)}
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
                className="w-24 rounded-lg border border-neutral-300 px-2 py-2 text-sm"
              />
              <span className="w-14 shrink-0 text-xs text-neutral-500">{item.unidad}</span>
              <button type="button" onClick={() => quitarFila(index)} className="shrink-0 text-red-600">
                <IconTrash width={16} height={16} />
              </button>
            </div>
          ))}

          {items.length === 0 && <p className="text-sm text-neutral-400">Sin insumos en la receta todavía.</p>}

          <button
            type="button"
            onClick={agregarFila}
            disabled={insumos.length === 0 || items.length >= insumos.length}
            className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 disabled:opacity-40"
          >
            <IconPlus width={14} height={14} />
            Agregar insumo
          </button>

          {insumos.length === 0 && (
            <p className="text-xs text-amber-600">No hay insumos activos en el catálogo — creá alguno en "Insumos y stock" primero.</p>
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

function ProductoModal({ token, onCerrar }: { token: string | null; onCerrar: () => void }) {
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

        <IconInput icon={IconTag} name="nombre" placeholder="Nombre" required />
        <IconInput icon={IconFolder} name="categoria" placeholder="Categoría" required />
        <IconInput
          icon={IconCoin}
          name="precio"
          type="number"
          step="0.01"
          min="0"
          placeholder="Precio"
          required
        />
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

        <IconInput icon={IconTag} name="nombre" placeholder="Nombre (ej. Arroz)" required />
        <IconInput
          icon={IconCoin}
          name="precio"
          type="number"
          step="0.01"
          min="0"
          placeholder="Precio"
          required
        />

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
