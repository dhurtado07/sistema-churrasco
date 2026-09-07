import type { Compra as CompraDTO, CrearCompraInput } from "shared";
import { prisma } from "../../db.js";

export class CompraValidationError extends Error {}

const compraInclude = { items: true, registradoPor: true, proveedor: true } as const;
type CompraConRelaciones = Awaited<
  ReturnType<typeof prisma.compra.findFirstOrThrow<{ include: typeof compraInclude }>>
>;

function toDTO(compra: CompraConRelaciones): CompraDTO {
  return {
    id: compra.id,
    proveedorId: compra.proveedorId,
    proveedorNombre: compra.proveedorNombre,
    fecha: compra.fecha.toISOString(),
    total: compra.total,
    notas: compra.notas,
    registradoPorNombre: compra.registradoPor.nombre,
    items: compra.items.map((item) => ({
      id: item.id,
      insumo: item.insumo,
      categoria: item.categoria,
      cantidad: item.cantidad,
      unidad: item.unidad,
      precioUnitario: item.precioUnitario,
      subtotal: item.subtotal,
      insumoId: item.insumoId,
    })),
  };
}

export async function crearCompra(input: CrearCompraInput, usuarioId: string): Promise<CompraDTO> {
  let proveedorNombre = input.proveedorNombre ?? null;
  if (input.proveedorId) {
    const proveedor = await prisma.proveedor.findUnique({ where: { id: input.proveedorId } });
    if (!proveedor) throw new CompraValidationError("Proveedor no encontrado");
    proveedorNombre = proveedor.nombre;
  }

  const insumoIds = [...new Set(input.items.map((i) => i.insumoId).filter((v): v is string => Boolean(v)))];
  if (insumoIds.length > 0) {
    const insumos = await prisma.insumo.findMany({ where: { id: { in: insumoIds } } });
    if (insumos.length !== insumoIds.length) throw new CompraValidationError("Uno o más insumos linkeados no existen.");
  }

  const itemsData = input.items.map((item) => ({
    insumo: item.insumo,
    categoria: item.categoria ?? null,
    cantidad: item.cantidad,
    unidad: item.unidad,
    precioUnitario: item.precioUnitario,
    subtotal: item.cantidad * item.precioUnitario,
    insumoId: item.insumoId ?? null,
  }));
  const total = itemsData.reduce((sum, item) => sum + item.subtotal, 0);

  const compra = await prisma.$transaction(async (tx) => {
    const creada = await tx.compra.create({
      data: {
        proveedorId: input.proveedorId ?? null,
        proveedorNombre,
        notas: input.notas ?? null,
        total,
        registradoPorId: usuarioId,
        items: { create: itemsData },
      },
      include: compraInclude,
    });
    // Repone stock de cada insumo linkeado — una compra siempre suma
    // (nunca reduce), así que no hace falta el mapa de consumo de ventas.
    for (const item of itemsData) {
      if (item.insumoId) {
        await tx.insumo.update({ where: { id: item.insumoId }, data: { stockActual: { increment: item.cantidad } } });
      }
    }
    return creada;
  });

  return toDTO(compra);
}

export async function listarCompras(filtros: { proveedorId?: string; desde?: Date; hasta?: Date }): Promise<CompraDTO[]> {
  const compras = await prisma.compra.findMany({
    where: {
      proveedorId: filtros.proveedorId,
      fecha: filtros.desde || filtros.hasta ? { gte: filtros.desde, lte: filtros.hasta } : undefined,
    },
    include: compraInclude,
    orderBy: { fecha: "desc" },
    take: 200,
  });
  return compras.map(toDTO);
}
