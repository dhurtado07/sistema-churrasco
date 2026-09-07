import type { Configuracion } from "shared";
import { prisma } from "../../db.js";

const SINGLETON_ID = "singleton";

function toDTO(row: {
  cocinaHabilitada: boolean;
  parrillaHabilitada: boolean;
  entregaHabilitada: boolean;
  nombreNegocio: string;
  direccion: string | null;
  telefono: string | null;
  nit: string | null;
  logoUrl: string | null;
}): Configuracion {
  return {
    cocinaHabilitada: row.cocinaHabilitada,
    parrillaHabilitada: row.parrillaHabilitada,
    entregaHabilitada: row.entregaHabilitada,
    nombreNegocio: row.nombreNegocio,
    direccion: row.direccion,
    telefono: row.telefono,
    nit: row.nit,
    logoUrl: row.logoUrl,
  };
}

/** Crea la fila de configuración con los valores por defecto si todavía no existe. */
export async function obtenerConfiguracion(): Promise<Configuracion> {
  const row = await prisma.configuracion.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID },
  });
  return toDTO(row);
}

export async function actualizarConfiguracion(input: Partial<Configuracion>): Promise<Configuracion> {
  const row = await prisma.configuracion.upsert({
    where: { id: SINGLETON_ID },
    update: input,
    create: { id: SINGLETON_ID, ...input },
  });
  return toDTO(row);
}
