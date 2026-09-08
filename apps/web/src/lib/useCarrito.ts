import { useMemo, useState } from "react";
import type { Extra, ItemPedido, Producto } from "shared";

export interface LineaCarrito {
  lineaId: string;
  productoId: string;
  nombre: string;
  precioUnitario: number;
  requiereParrilla: boolean;
  cantidad: number;
  extraIds: string[];
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
    extraIds: item.extras.map((extra) => extra.extraId),
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
      const existente = prev.find((l) => l.productoId === producto.id && l.extraIds.length === 0);
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
          extraIds: [],
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

  function toggleExtra(lineaId: string, extraId: string) {
    setCarrito((prev) =>
      prev.map((linea) => {
        if (linea.lineaId !== lineaId) return linea;
        const tieneExtra = linea.extraIds.includes(extraId);
        return {
          ...linea,
          extraIds: tieneExtra ? linea.extraIds.filter((id) => id !== extraId) : [...linea.extraIds, extraId],
        };
      }),
    );
  }

  function quitarLinea(lineaId: string) {
    setCarrito((prev) => prev.filter((linea) => linea.lineaId !== lineaId));
  }

  const total = useMemo(() => {
    return carrito.reduce((suma, linea) => {
      const extrasTotal = linea.extraIds.reduce((s, id) => {
        const extra = extras.find((e) => e.id === id);
        return s + (extra?.precio ?? 0);
      }, 0);
      return suma + (linea.precioUnitario + extrasTotal) * linea.cantidad;
    }, 0);
  }, [carrito, extras]);

  return { carrito, setCarrito, agregarProducto, cambiarCantidad, toggleExtra, quitarLinea, total };
}
