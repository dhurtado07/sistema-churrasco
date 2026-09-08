import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Producto } from "shared";
import { apiFetch } from "../lib/api";
import { formatBs } from "../lib/format";
import {
  IconBag,
  IconCheck,
  IconHome,
  IconLogin,
  IconParrilla,
  IconUser,
} from "../components/icons";
import { iconoComida } from "../components/ImagenProducto";

interface NegocioPublico {
  nombreNegocio: string;
  direccion: string | null;
  telefono: string | null;
  logoUrl: string | null;
}

const HERO_IMG =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Steak_auf_Grill.jpg/500px-Steak_auf_Grill.jpg";

const SERVICIOS = [
  {
    icon: IconParrilla,
    titulo: "Parrilla en vivo",
    texto: "Carnes asadas al momento, a la vista, con el mismo fuego de siempre.",
  },
  {
    icon: IconHome,
    titulo: "Ambiente familiar",
    texto: "Un lugar cómodo para ir en grupo, en familia, o a celebrar cualquier ocasión.",
  },
  {
    icon: IconBag,
    titulo: "Para llevar",
    texto: "Pedí tu plato favorito para llevar, listo rápido y bien caliente.",
  },
  {
    icon: IconCheck,
    titulo: "Atención rápida",
    texto: "Cocina, parrilla y caja coordinadas para que tu pedido llegue sin demoras.",
  },
];

export function LandingPage() {
  const [negocio, setNegocio] = useState<NegocioPublico | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);

  useEffect(() => {
    apiFetch<NegocioPublico>("/publico/negocio", null).then(setNegocio).catch(() => {});
    apiFetch<{ productos: Producto[] }>("/publico/menu", null)
      .then((data) => setProductos(data.productos))
      .catch(() => {});
  }, []);

  const destacados = useMemo(() => productos.slice(0, 6), [productos]);
  const nombreNegocio = negocio?.nombreNegocio ?? "BRASA ARISP";

  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-8">
        <div className="flex items-center gap-2 font-extrabold tracking-tight text-stone-900">
          {negocio?.logoUrl ? (
            <img src={negocio.logoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-600 text-white">
              <IconParrilla width={18} height={18} />
            </span>
          )}
          <span className="text-lg sm:text-xl">{nombreNegocio}</span>
        </div>
        <Link
          to="/login"
          className="flex items-center gap-2 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 active:bg-red-900"
        >
          <IconLogin width={16} height={16} />
          Iniciar sesión
        </Link>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-stone-900 text-white">
        <img
          src={HERO_IMG}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/70 to-orange-900/40" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-5 px-4 py-20 text-center sm:py-28">
          <span className="rounded-full bg-orange-500/90 px-4 py-1 text-xs font-bold uppercase tracking-widest">
            Sabor a la parrilla
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">{nombreNegocio}</h1>
          <p className="max-w-xl text-base text-stone-200 sm:text-lg">
            Carnes jugosas, cocinadas al fuego con dedicación de siempre. Un lugar para compartir
            en familia, con amigos, o celebrar cualquier momento.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#menu"
              className="rounded-full bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-orange-600"
            >
              Ver nuestro menú
            </a>
            <Link
              to="/login"
              className="rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </section>

      {/* Sobre nosotros */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-orange-600">Sobre nosotros</h2>
        <p className="mt-4 text-2xl font-bold text-stone-900 sm:text-3xl">
          Tradición, fuego y buena compañía
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-stone-600">
          En {nombreNegocio} creemos que una buena comida se disfruta mejor acompañada. Seleccionamos
          cortes de calidad y los preparamos a la parrilla, con el cuidado de quien cocina para su
          propia familia. Cada plato sale directo del fuego a tu mesa, tal como debe ser una
          verdadera churrasquería.
        </p>
      </section>

      {/* Servicios */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-8">
          <h2 className="text-center text-sm font-bold uppercase tracking-widest text-orange-600">
            Servicios
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICIOS.map((s) => (
              <div
                key={s.titulo}
                className="rounded-2xl border border-stone-200 bg-gradient-to-b from-orange-50 to-white p-5 text-center shadow-sm"
              >
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-700 text-white">
                  <s.icon width={22} height={22} />
                </span>
                <p className="mt-3 font-bold text-stone-900">{s.titulo}</p>
                <p className="mt-1 text-sm text-stone-600">{s.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Productos destacados */}
      <section id="menu" className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
        <h2 className="text-center text-sm font-bold uppercase tracking-widest text-orange-600">
          Nuestro menú
        </h2>
        <p className="mt-2 text-center text-2xl font-bold text-stone-900 sm:text-3xl">
          Platos que se preparan al momento
        </p>

        {destacados.length === 0 && (
          <p className="mt-8 text-center text-sm text-stone-400">Cargando menú…</p>
        )}

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {destacados.map((producto) => (
            <div
              key={producto.id}
              className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md"
            >
              {producto.imagenUrl ? (
                <img
                  src={producto.imagenUrl}
                  alt={producto.nombre}
                  className="h-40 w-full object-cover"
                />
              ) : (
                (() => {
                  const IconoTipo = iconoComida(producto.nombre, producto.categoria);
                  return (
                    <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-orange-100 to-red-100 text-orange-400">
                      <IconoTipo width={40} height={40} />
                    </div>
                  );
                })()
              )}
              <div className="p-4">
                <p className="font-bold text-stone-900">{producto.nombre}</p>
                <p className="mt-1 text-sm font-semibold text-orange-600">
                  Bs {formatBs(producto.precio)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {productos.length > destacados.length && (
          <div className="mt-8 text-center">
            <Link
              to="/menu"
              className="inline-block rounded-full bg-stone-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-stone-800"
            >
              Ver menú completo
            </Link>
          </div>
        )}
      </section>

      {/* Contacto */}
      <section className="bg-stone-900 py-16 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-orange-400">Visitanos</h2>
          <p className="mt-3 text-2xl font-bold sm:text-3xl">Te esperamos con las brasas listas</p>
          <div className="mt-5 flex flex-col items-center gap-2 text-stone-300">
            {negocio?.direccion && (
              <span className="flex items-center gap-2">
                <IconHome width={16} height={16} />
                {negocio.direccion}
              </span>
            )}
            {negocio?.telefono && (
              <span className="flex items-center gap-2">
                <IconUser width={16} height={16} />
                {negocio.telefono}
              </span>
            )}
            {!negocio?.direccion && !negocio?.telefono && (
              <span className="text-sm text-stone-400">
                Dirección y teléfono próximamente — completalos desde /admin/configuración.
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-col items-center gap-2 bg-stone-950 px-4 py-6 text-center text-xs text-stone-500">
        <p>
          © {new Date().getFullYear()} {nombreNegocio}
        </p>
        <Link to="/login" className="text-stone-400 underline-offset-2 hover:text-white hover:underline">
          Acceso para personal
        </Link>
      </footer>
    </div>
  );
}
