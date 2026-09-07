import type { Proveedor as ProveedorDTO, CrearProveedorInput, ActualizarProveedorInput } from "shared";
import { prisma } from "../../db.js";

function toDTO(row: {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  categoria: string | null;
  activo: boolean;
}): ProveedorDTO {
  return {
    id: row.id,
    nombre: row.nombre,
    contacto: row.contacto,
    telefono: row.telefono,
    categoria: row.categoria,
    activo: row.activo,
  };
}

export async function listarProveedores(soloActivos = false): Promise<ProveedorDTO[]> {
  const proveedores = await prisma.proveedor.findMany({
    where: soloActivos ? { activo: true } : undefined,
    orderBy: { nombre: "asc" },
  });
  return proveedores.map(toDTO);
}

export async function crearProveedor(input: CrearProveedorInput): Promise<ProveedorDTO> {
  const proveedor = await prisma.proveedor.create({
    data: {
      nombre: input.nombre,
      contacto: input.contacto ?? null,
      telefono: input.telefono ?? null,
      categoria: input.categoria ?? null,
    },
  });
  return toDTO(proveedor);
}

export async function actualizarProveedor(id: string, input: ActualizarProveedorInput): Promise<ProveedorDTO> {
  const proveedor = await prisma.proveedor.update({ where: { id }, data: input });
  return toDTO(proveedor);
}
