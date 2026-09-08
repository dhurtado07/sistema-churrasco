import { useState, type SVGProps } from "react";
import {
  IconComidaArroz,
  IconComidaBebida,
  IconComidaCarne,
  IconComidaChorizo,
  IconComidaEnsalada,
  IconComidaPapas,
  IconComidaPlato,
  IconComidaPollo,
} from "./icons";

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Elige un ícono de comida por palabras clave en el nombre (y opcionalmente
 * la categoría) del producto/extra — para que el respaldo sin foto todavía
 * diga algo ("esto es pollo") en vez de ser un cuadro vacío genérico. */
export function iconoComida(nombre: string, categoria?: string): (props: SVGProps<SVGSVGElement>) => JSX.Element {
  const n = normalizar(nombre);
  const c = categoria ? normalizar(categoria) : "";
  if (/pollo|chicken/.test(n)) return IconComidaPollo;
  if (/chorizo|salchicha/.test(n)) return IconComidaChorizo;
  if (/arroz/.test(n)) return IconComidaArroz;
  if (/papa|frita/.test(n)) return IconComidaPapas;
  if (/ensalada|vegetarian|verdura|vegetal/.test(n) || /vegetarian/.test(c)) return IconComidaEnsalada;
  if (/carne|churrasco|costilla|bife|res\b|bbq|cerdo|chuleta|lomo/.test(n)) return IconComidaCarne;
  if (/gaseosa|jugo|agua|bebida|refresco|cerveza|soda|malta/.test(n) || /bebida/.test(c)) return IconComidaBebida;
  return IconComidaPlato;
}

/**
 * Imagen de un producto/extra con respaldo garantizado: si no hay foto propia
 * todavía, muestra un ícono según el tipo de comida en vez de dejar el espacio
 * vacío o en blanco — para que siempre haya algo visual que identificar de un
 * vistazo (clave en Caja: la cajera reconoce el plato sin tener que leer).
 */
export function ImagenProducto({
  imagenUrl,
  nombre,
  categoria,
  className,
}: {
  imagenUrl?: string | null;
  nombre: string;
  categoria?: string;
  className: string;
}) {
  const [fallo, setFallo] = useState(false);
  // Si la URL de la imagen no carga (link roto, host caído, red lenta), cae
  // al ícono en vez de quedar en blanco — el respaldo tiene que ser garantía,
  // no solo para cuando falta la foto sino también para cuando falla.
  if (imagenUrl && !fallo) {
    return <img src={imagenUrl} alt={nombre} onError={() => setFallo(true)} className={`${className} object-cover`} />;
  }
  const Icono = iconoComida(nombre, categoria);
  return (
    <div className={`flex items-center justify-center bg-orange-50 text-orange-400 ${className}`}>
      <Icono className="h-1/2 w-1/2" strokeWidth={1.4} />
    </div>
  );
}
