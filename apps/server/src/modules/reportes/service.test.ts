import { describe, expect, it, vi } from "vitest";
import { totalLinea } from "shared";

// Un pedido con plato x2 y un extra: lo que se cobró (pedido.total) tiene que
// coincidir con la suma de las líneas por producto que muestra el reporte.
type ExtraDePrueba = { extraId?: string; nombre?: string; precio: number; cantidad: number };
const item = (productoId: string, cantidad: number, precioUnitario: number, extras: ExtraDePrueba[]) => ({
  productoId,
  nombreProducto: productoId,
  cantidad,
  precioUnitario,
  extras: extras.map((e) => ({ extraId: e.extraId ?? `extra-${e.precio}`, nombre: e.nombre ?? `Extra ${e.precio}`, ...e })),
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

  it("los extras van en su propia fila y el precio unitario del plato queda en su precio real", async () => {
    const items = [
      item("churrasco", 2, 37, [{ extraId: "arroz", nombre: "Arroz extra", precio: 8, cantidad: 1 }]),
      item("churrasco", 1, 37, [{ extraId: "arroz", nombre: "Arroz extra", precio: 8, cantidad: 2 }]),
      item("refresco", 3, 10, []),
    ];
    pedidos.length = 0;
    pedidos.push({ total: 111 + 24 + 30, tipoConsumo: "LOCAL", items });

    const reporte = await reporteGanancias(new Date());
    expect(reporte.porProducto).toEqual([
      { productoId: "churrasco", nombre: "churrasco", esExtra: false, cantidad: 3, total: 111 },
      { productoId: "refresco", nombre: "refresco", esExtra: false, cantidad: 3, total: 30 },
      { productoId: "arroz", nombre: "Arroz extra", esExtra: true, cantidad: 3, total: 24 },
    ]);
  });
});
