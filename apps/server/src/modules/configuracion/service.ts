import type { Configuracion } from "shared";
import { prisma } from "../../db.js";

const SINGLETON_ID = "singleton";

export class ConfiguracionValidationError extends Error {}

function toDTO(row: {
  cocinaHabilitada: boolean;
  parrillaHabilitada: boolean;
  entregaHabilitada: boolean;
  mesaHabilitada: boolean;
  nombreNegocio: string;
  direccion: string | null;
  telefono: string | null;
  nit: string | null;
  logoUrl: string | null;
  pagoEfectivoHabilitado: boolean;
  pagoTarjetaHabilitado: boolean;
  pagoTransferenciaHabilitado: boolean;
  pagoQrHabilitado: boolean;
  qrPagoUrl: string | null;
}): Configuracion {
  return {
    cocinaHabilitada: row.cocinaHabilitada,
    parrillaHabilitada: row.parrillaHabilitada,
    entregaHabilitada: row.entregaHabilitada,
    mesaHabilitada: row.mesaHabilitada,
    nombreNegocio: row.nombreNegocio,
    direccion: row.direccion,
    telefono: row.telefono,
    nit: row.nit,
    logoUrl: row.logoUrl,
    pagoEfectivoHabilitado: row.pagoEfectivoHabilitado,
    pagoTarjetaHabilitado: row.pagoTarjetaHabilitado,
    pagoTransferenciaHabilitado: row.pagoTransferenciaHabilitado,
    pagoQrHabilitado: row.pagoQrHabilitado,
    qrPagoUrl: row.qrPagoUrl,
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
  // Si esta actualización deja algún método de pago apagado, hay que revisar
  // el resultado final (no solo lo que llega en `input`) para no permitir que
  // Caja se quede sin ninguna forma de cobrar.
  const metodosTocados =
    input.pagoEfectivoHabilitado !== undefined ||
    input.pagoTarjetaHabilitado !== undefined ||
    input.pagoTransferenciaHabilitado !== undefined ||
    input.pagoQrHabilitado !== undefined;
  if (metodosTocados) {
    const actual = await obtenerConfiguracion();
    const resultante = {
      efectivo: input.pagoEfectivoHabilitado ?? actual.pagoEfectivoHabilitado,
      tarjeta: input.pagoTarjetaHabilitado ?? actual.pagoTarjetaHabilitado,
      transferencia: input.pagoTransferenciaHabilitado ?? actual.pagoTransferenciaHabilitado,
      qr: input.pagoQrHabilitado ?? actual.pagoQrHabilitado,
    };
    if (!resultante.efectivo && !resultante.tarjeta && !resultante.transferencia && !resultante.qr) {
      throw new ConfiguracionValidationError("Tiene que quedar al menos un método de pago habilitado.");
    }
  }

  const row = await prisma.configuracion.upsert({
    where: { id: SINGLETON_ID },
    update: input,
    create: { id: SINGLETON_ID, ...input },
  });
  return toDTO(row);
}
