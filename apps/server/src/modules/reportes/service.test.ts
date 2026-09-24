import { describe, expect, it, vi } from "vitest";
import { totalLinea } from "shared";

// Un pedido con plato x2 y un extra: lo que se cobró (pedido.total) tiene que
// coincidir con la suma de las líneas por producto que muestra el reporte.
const item = (productoId: string, cantidad: number, precioUnitario: number, extras: { precio: number; cantidad: number }[]) => ({
  productoId,
  nombreProducto: productoId,
  cantidad,
  precioUnitario,
  extras,
});

const pedidos = vi.hoisted(() => [] as unknown[]);

vi.mock("../../db.js", () => ({ prisma: { pedido: { findMany: async () => pedidos } } }));

import { reporteGanancias } from "./service.js";

describe("reporteGanancias: las líneas por producto suman el total vendido", () => {
  it("con extras en platos de cantidad mayor a 1", async () => {
    const items1 = [item("churrasco", 2, 37, [{ precio: 8, cantidad: 1 }]), item("refresco", 3, 10, [])];
    const items2 = [item("churrasco", 1, 37, [{ precio: 8, cantidad: 2 }])];
    const total = (items: ReturnType<typeof item>[]) => items.reduce((s, i) => s + totalLinea(i.precioUnitario, i.cantidad, i.extras), 0);
    pedidos.push(
      { total: total(items1), tipoConsumo: "LOCAL", items: items1 },
      { total: total(items2), tipoConsumo: "LLEVAR", items: items2 },
    );

    const reporte = await reporteGanancias(new Date());
    const sumaProductos = reporte.porProducto.reduce((s, p) => s + p.total, 0);
    expect(reporte.totalVendido).toBe(82 + 30 + 53);
    expect(sumaProductos).toBe(reporte.totalVendido);
  });
});
