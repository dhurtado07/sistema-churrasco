import { useMemo, useState } from "react";
import type { Extra, ItemPedido, Producto } from "shared";

export interface ExtraLineaCarrito {
  extraId: string;
  cantidad: number;
}

export interface LineaCarrito {
  lineaId: string;
  productoId: string;
  nombre: string;
  precioUnitario: number;
  requiereParrilla: boolean;
  cantidad: number;
  extras: ExtraLineaCarrito[];
}

/** Convierte los ítems ya guardados de un pedido a líneas de carrito editables. */
export function itemsPedidoACarrito(items: ItemPedido[]): LineaCarrito[] {
  return items.map((item) => ({
    lineaId: crypto.randomUUID(),
    productoId: item.productoId,
    nombre: item.nombreProducto,
    precioUnitario: item.precioUnitario,
    requiereParrilla: item.requiereParrilla,
    cantidad: item.cantidad,
    extras: item.extras.map((extra) => ({ extraId: extra.extraId, cantidad: extra.cantidad })),
  }));
}

export function useCarrito(extras: Extra[], inicial: LineaCarrito[] = []) {
  const [carrito, setCarrito] = useState<LineaCarrito[]>(inicial);

  function agregarProducto(producto: Producto) {
    setCarrito((prev) => {
      // Mismo plato, sin extras propios todavía → suma cantidad en la misma
      // línea en vez de abrir una segunda tarjeta idéntica. Si ya tiene
      // extras, queda aparte: "pollo con arroz" no es lo mismo que "otro
      // pollo solo".
      const existente = prev.find((l) => l.productoId === producto.id && l.extras.length === 0);
      if (existente) {
        return prev.map((l) => (l.lineaId === existente.lineaId ? { ...l, cantidad: l.cantidad + 1 } : l));
      }
      return [
        ...prev,
        {
          lineaId: crypto.randomUUID(),
          productoId: producto.id,
          nombre: producto.nombre,
          precioUnitario: producto.precio,
          requiereParrilla: producto.requiereParrilla,
          cantidad: 1,
          extras: [],
        },
      ];
    });
  }

  function cambiarCantidad(lineaId: string, delta: number) {
    setCarrito((prev) =>
      prev
        .map((linea) => (linea.lineaId === lineaId ? { ...linea, cantidad: linea.cantidad + delta } : linea))
        .filter((linea) => linea.cantidad > 0),
    );
  }

  /** Suma o resta unidades de un extra en una línea — un cliente puede pedir
   * más de una porción del mismo extra (ej. 2 porciones de arroz), así que
   * esto es una cantidad, no un simple on/off. Llegar a 0 saca el extra de
   * la línea. */
  function cambiarCantidadExtra(lineaId: string, extraId: string, delta: number) {
    setCarrito((prev) =>
      prev.map((linea) => {
        if (linea.lineaId !== lineaId) return linea;
        const existente = linea.extras.find((e) => e.extraId === extraId);
        const nuevaCantidad = (existente?.cantidad ?? 0) + delta;
        if (nuevaCantidad <= 0) {
          return { ...linea, extras: linea.extras.filter((e) => e.extraId !== extraId) };
        }
        if (existente) {
          return {
            ...linea,
            extras: linea.extras.map((e) => (e.extraId === extraId ? { ...e, cantidad: nuevaCantidad } : e)),
          };
        }
        return { ...linea, extras: [...linea.extras, { extraId, cantidad: nuevaCantidad }] };
      }),
    );
  }

  function quitarLinea(lineaId: string) {
    setCarrito((prev) => prev.filter((linea) => linea.lineaId !== lineaId));
  }

  const total = useMemo(() => {
    return carrito.reduce((suma, linea) => {
      const extrasTotal = linea.extras.reduce((s, sel) => {
        const extra = extras.find((e) => e.id === sel.extraId);
        return s + (extra?.precio ?? 0) * sel.cantidad;
      }, 0);
      return suma + (linea.precioUnitario + extrasTotal) * linea.cantidad;
    }, 0);
  }, [carrito, extras]);

  return { carrito, setCarrito, agregarProducto, cambiarCantidad, cambiarCantidadExtra, quitarLinea, total };
}
