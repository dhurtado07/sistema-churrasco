import type { ItemPedido } from "shared";
import { ImagenProducto } from "./ImagenProducto";
import { lineasDelPedido } from "../lib/pedidosDisplay";

const TAMANOS = {
  // Cocina y parrilla: se lee de lejos, mientras se cocina.
  grande: { fila: "gap-3 py-2.5", imagen: "h-16 w-16 rounded-xl", texto: "text-xl font-bold leading-tight" },
  mediano: { fila: "gap-3 py-2", imagen: "h-14 w-14 rounded-lg", texto: "text-lg font-semibold" },
} as const;

/** Platos y extras de un pedido, todos como líneas iguales con foto y cantidad. */
export function LineasPedido({ items, tamano }: { items: ItemPedido[]; tamano: keyof typeof TAMANOS }) {
  const t = TAMANOS[tamano];
  return (
    <ul className="divide-y divide-neutral-100">
      {lineasDelPedido(items).map((linea) => (
        <li key={linea.key} className={`flex items-center first:pt-0 ${t.fila}`}>
          <ImagenProducto imagenUrl={linea.imagenUrl} nombre={linea.nombre} className={`shrink-0 ${t.imagen}`} />
          <p className={`min-w-0 text-neutral-900 ${t.texto}`}>
            {linea.cantidad}x {linea.nombre}
          </p>
        </li>
      ))}
    </ul>
  );
}
