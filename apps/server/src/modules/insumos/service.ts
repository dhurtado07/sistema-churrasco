import type { Insumo as InsumoDTO, CrearInsumoInput, ActualizarInsumoInput, RecetaItem as RecetaItemDTO, ActualizarRecetaInput } from "shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";

export class InsumoValidationError extends Error {}

function toDTO(insumo: {
  id: string;
  nombre: string;
  categoria: string | null;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
  createdAt: Date;
}): InsumoDTO {
  return {
    id: insumo.id,
    nombre: insumo.nombre,
    categoria: insumo.categoria,
    unidad: insumo.unidad,
    stockActual: insumo.stockActual,
    stockMinimo: insumo.stockMinimo,
    activo: insumo.activo,
    creadoEn: insumo.createdAt.toISOString(),
  };
}

export async function listarInsumos(soloActivos = false): Promise<InsumoDTO[]> {
  const insumos = await prisma.insumo.findMany({
    where: soloActivos ? { activo: true } : undefined,
    orderBy: { nombre: "asc" },
  });
  return insumos.map(toDTO);
}

export async function crearInsumo(input: CrearInsumoInput): Promise<InsumoDTO> {
  try {
    const insumo = await prisma.insumo.create({
      data: {
        nombre: input.nombre,
        categoria: input.categoria ?? null,
        unidad: input.unidad,
        stockActual: input.stockInicial,
        stockMinimo: input.stockMinimo,
      },
    });
    return toDTO(insumo);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new InsumoValidationError("Ya existe un insumo con ese nombre.");
    }
    throw error;
  }
}

export async function actualizarInsumo(id: string, input: ActualizarInsumoInput): Promise<InsumoDTO> {
  try {
    const insumo = await prisma.insumo.update({ where: { id }, data: input });
    return toDTO(insumo);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new InsumoValidationError("Ya existe un insumo con ese nombre.");
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new InsumoValidationError("Insumo no encontrado.");
    }
    throw error;
  }
}

/** Ajuste manual del stock (conteo físico, merma, producto vencido, etc.) —
 * ninguna receta va a ser perfecta, así que esto es lo que mantiene el
 * número honesto. A diferencia del libro de caja, no se guarda un historial
 * de ajustes por ahora (alcance mínimo viable); si hace falta auditarlos más
 * adelante, se puede agregar una tabla de movimientos como la de caja. */
export async function ajustarStockInsumo(id: string, delta: number): Promise<InsumoDTO> {
  const actual = await prisma.insumo.findUnique({ where: { id } });
  if (!actual) throw new InsumoValidationError("Insumo no encontrado.");
  const insumo = await prisma.insumo.update({
    where: { id },
    data: { stockActual: actual.stockActual + delta },
  });
  return toDTO(insumo);
}

// ---------------------------------------------------------------------------
// Receta (BOM) por producto — cuánto de cada insumo consume una unidad
// vendida. Se reemplaza entera cada vez (mismo patrón que "editar pedido":
// más simple que un diff campo por campo).
// ---------------------------------------------------------------------------

export async function obtenerReceta(productoId: string): Promise<RecetaItemDTO[]> {
  const items = await prisma.recetaItem.findMany({
    where: { productoId },
    include: { insumo: true },
    orderBy: { insumo: { nombre: "asc" } },
  });
  return items.map((i) => ({
    insumoId: i.insumoId,
    insumoNombre: i.insumo.nombre,
    unidad: i.insumo.unidad,
    cantidadPorUnidad: i.cantidadPorUnidad,
  }));
}

export async function actualizarReceta(productoId: string, input: ActualizarRecetaInput): Promise<RecetaItemDTO[]> {
  const producto = await prisma.producto.findUnique({ where: { id: productoId } });
  if (!producto) throw new InsumoValidationError("Producto no encontrado.");

  const insumoIds = input.items.map((i) => i.insumoId);
  const insumosExistentes = await prisma.insumo.findMany({ where: { id: { in: insumoIds } } });
  if (insumosExistentes.length !== new Set(insumoIds).size) {
    throw new InsumoValidationError("Uno o más insumos de la receta no existen.");
  }

  await prisma.$transaction([
    prisma.recetaItem.deleteMany({ where: { productoId } }),
    prisma.recetaItem.createMany({
      data: input.items.map((i) => ({ productoId, insumoId: i.insumoId, cantidadPorUnidad: i.cantidadPorUnidad })),
    }),
  ]);

  return obtenerReceta(productoId);
}

// ---------------------------------------------------------------------------
// Descuento/reposición de stock por venta — llamado desde pedidos/service.ts
// dentro de su propia transacción, para que el pedido y el movimiento de
// stock queden atómicos (o pasan los dos, o no pasa ninguno).
// ---------------------------------------------------------------------------

/** Descuenta (factor -1) o repone (factor +1) el stock consumido por una
 * lista de ítems de pedido, según la receta de cada producto. Productos sin
 * receta simplemente no tocan ningún stock. Nunca bloquea la venta si el
 * stock queda negativo — es informativo, no un límite duro (una carnicería
 * no debe dejar de vender churrasco porque la receta se quedó desactualizada
 * en un gramo); el stock bajo/negativo se ve como alerta en /admin/insumos. */
export async function ajustarStockPorVenta(
  tx: Prisma.TransactionClient,
  items: { productoId: string; cantidad: number }[],
  factor: 1 | -1,
): Promise<void> {
  if (items.length === 0) return;
  const productoIds = [...new Set(items.map((i) => i.productoId))];
  const recetas = await tx.recetaItem.findMany({ where: { productoId: { in: productoIds } } });
  if (recetas.length === 0) return;

  const recetaPorProducto = new Map<string, { insumoId: string; cantidadPorUnidad: number }[]>();
  for (const r of recetas) {
    const lista = recetaPorProducto.get(r.productoId) ?? [];
    lista.push({ insumoId: r.insumoId, cantidadPorUnidad: r.cantidadPorUnidad });
    recetaPorProducto.set(r.productoId, lista);
  }

  const consumoPorInsumo = new Map<string, number>();
  for (const item of items) {
    for (const r of recetaPorProducto.get(item.productoId) ?? []) {
      consumoPorInsumo.set(r.insumoId, (consumoPorInsumo.get(r.insumoId) ?? 0) + r.cantidadPorUnidad * item.cantidad);
    }
  }

  for (const [insumoId, cantidad] of consumoPorInsumo) {
    await tx.insumo.update({ where: { id: insumoId }, data: { stockActual: { increment: factor * cantidad } } });
  }
}
