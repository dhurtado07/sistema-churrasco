import type { ActivoInventario as ActivoDTO, CrearActivoInventarioInput, ActualizarActivoInventarioInput } from "shared";
import { prisma } from "../../db.js";

function toDTO(row: {
  id: string;
  nombre: string;
  categoria: string | null;
  cantidad: number;
  estado: string;
  valorUnitario: number | null;
  fechaAdquisicion: Date | null;
  notas: string | null;
  activo: boolean;
}): ActivoDTO {
  return {
    id: row.id,
    nombre: row.nombre,
    categoria: row.categoria,
    cantidad: row.cantidad,
    estado: row.estado as ActivoDTO["estado"],
    valorUnitario: row.valorUnitario,
    fechaAdquisicion: row.fechaAdquisicion ? row.fechaAdquisicion.toISOString() : null,
    notas: row.notas,
    activo: row.activo,
  };
}

export async function listarActivos(soloActivos = false): Promise<ActivoDTO[]> {
  const activos = await prisma.activoInventario.findMany({
    where: soloActivos ? { activo: true } : undefined,
    orderBy: { nombre: "asc" },
  });
  return activos.map(toDTO);
}

export async function crearActivo(input: CrearActivoInventarioInput): Promise<ActivoDTO> {
  const activo = await prisma.activoInventario.create({
    data: {
      nombre: input.nombre,
      categoria: input.categoria ?? null,
      cantidad: input.cantidad,
      estado: input.estado,
      valorUnitario: input.valorUnitario ?? null,
      fechaAdquisicion: input.fechaAdquisicion ? new Date(input.fechaAdquisicion) : null,
      notas: input.notas ?? null,
    },
  });
  return toDTO(activo);
}

export async function actualizarActivo(id: string, input: ActualizarActivoInventarioInput): Promise<ActivoDTO> {
  const activo = await prisma.activoInventario.update({
    where: { id },
    data: {
      ...input,
      fechaAdquisicion: input.fechaAdquisicion ? new Date(input.fechaAdquisicion) : undefined,
    },
  });
  return toDTO(activo);
}
