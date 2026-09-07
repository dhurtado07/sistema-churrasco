import { useEffect, useMemo, useState } from "react";
import type { Extra, Producto } from "shared";
import { apiFetch } from "../lib/api";
import { IconHome, IconNegocio, IconUser } from "../components/icons";

interface NegocioPublico {
  nombreNegocio: string;
  direccion: string | null;
  telefono: string | null;
  logoUrl: string | null;
}

export function MenuPublicoPage() {
  const [negocio, setNegocio] = useState<NegocioPublico | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);

  useEffect(() => {
    apiFetch<NegocioPublico>("/publico/negocio", null).then(setNegocio);
    apiFetch<{ productos: Producto[]; extras: Extra[] }>("/publico/menu", null).then((data) => {
      setProductos(data.productos);
      setExtras(data.extras);
    });
  }, []);

  const categorias = useMemo(() => {
    const grupos = new Map<string, Producto[]>();
    for (const producto of productos) {
      const lista = grupos.get(producto.categoria) ?? [];
      lista.push(producto);
      grupos.set(producto.categoria, lista);
    }
    return [...grupos.entries()];
  }, [productos]);

  return (
    <div className="min-h-dvh bg-neutral-100">
      <header className="bg-neutral-900 px-4 py-8 text-center text-white sm:py-12">
        {negocio?.logoUrl && (
          <img src={negocio.logoUrl} alt="" className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />
        )}
        <h1 className="text-2xl font-bold sm:text-3xl">{negocio?.nombreNegocio ?? "BRASA ARISP"}</h1>
        <div className="mt-2 flex flex-col items-center gap-1 text-sm text-neutral-300 sm:flex-row sm:justify-center sm:gap-4">
          {negocio?.direccion && (
            <span className="flex items-center gap-1.5">
              <IconHome width={14} height={14} />
              {negocio.direccion}
            </span>
          )}
          {negocio?.telefono && (
            <span className="flex items-center gap-1.5">
              <IconUser width={14} height={14} />
              {negocio.telefono}
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        {categorias.map(([categoria, items]) => (
          <section key={categoria}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              <IconNegocio width={16} height={16} />
              {categoria}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((producto) => (
                <div key={producto.id} className="flex overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                  {producto.imagenUrl && (
                    <img src={producto.imagenUrl} alt={producto.nombre} className="h-24 w-24 shrink-0 object-cover" />
                  )}
                  <div className="p-3">
                    <p className="font-medium text-neutral-900">{producto.nombre}</p>
                    <p className="text-sm font-semibold text-neutral-700">Bs {producto.precio.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {productos.length === 0 && <p className="text-center text-sm text-neutral-400">Cargando menú…</p>}

        {extras.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Extras</h2>
            <ul className="flex flex-wrap gap-2">
              {extras.map((extra) => (
                <li key={extra.id} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm shadow-sm">
                  {extra.nombre} · Bs {extra.precio.toFixed(2)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
