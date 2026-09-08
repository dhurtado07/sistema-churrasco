import type { MarcaAsistencia as MarcaDTO, HorasTrabajadasEmpleado, TipoMarcaAsistencia } from "shared";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { prisma } from "../../db.js";

export class AsistenciaValidationError extends Error {}

export async function obtenerEmpleadoPorUsuario(usuarioId: string) {
  const empleado = await prisma.empleado.findUnique({ where: { usuarioId }, include: { usuario: true } });
  if (!empleado) throw new AsistenciaValidationError("Esta cuenta no está asociada a un empleado.");
  return empleado;
}

function toMarcaDTO(marca: { id: string; empleadoId: string; tipo: string; momento: Date; origen: string }, empleadoNombre: string): MarcaDTO {
  return {
    id: marca.id,
    empleadoId: marca.empleadoId,
    empleadoNombre,
    tipo: marca.tipo as TipoMarcaAsistencia,
    momento: marca.momento.toISOString(),
    origen: marca.origen as MarcaDTO["origen"],
  };
}

export async function marcarPropia(usuarioId: string, notas?: string, pin?: string): Promise<MarcaDTO> {
  const empleado = await obtenerEmpleadoPorUsuario(usuarioId);

  // Si el empleado tiene un PIN configurado, es obligatorio y se valida acá
  // mismo (no solo en el frontend) — es lo que evita que alguien marque por
  // otro reusando una sesión ya abierta en un kiosko compartido.
  if (empleado.pinHash) {
    if (!pin) throw new AsistenciaValidationError("Ingresá tu PIN para confirmar.");
    const pinValido = await bcrypt.compare(pin, empleado.pinHash);
    if (!pinValido) throw new AsistenciaValidationError("PIN incorrecto.");
  }

  const ultima = await prisma.asistencia.findFirst({
    where: { empleadoId: empleado.id },
    orderBy: { momento: "desc" },
  });
  const siguienteTipo: TipoMarcaAsistencia = !ultima || ultima.tipo === "SALIDA" ? "ENTRADA" : "SALIDA";

  const marca = await prisma.asistencia.create({
    data: { empleadoId: empleado.id, tipo: siguienteTipo, origen: "KIOSKO", notas: notas ?? null },
  });
  return toMarcaDTO(marca, empleado.usuario.nombre);
}

export async function obtenerProximaMarca(usuarioId: string): Promise<{ tipo: TipoMarcaAsistencia; requierePin: boolean }> {
  const empleado = await obtenerEmpleadoPorUsuario(usuarioId);
  const ultima = await prisma.asistencia.findFirst({
    where: { empleadoId: empleado.id },
    orderBy: { momento: "desc" },
  });
  return {
    tipo: !ultima || ultima.tipo === "SALIDA" ? "ENTRADA" : "SALIDA",
    requierePin: Boolean(empleado.pinHash),
  };
}

function calcularHoras(marcas: { tipo: string; momento: Date }[]): number {
  const ordenadas = [...marcas].sort((a, b) => a.momento.getTime() - b.momento.getTime());
  let totalMs = 0;
  let entradaAbierta: Date | null = null;
  for (const marca of ordenadas) {
    if (marca.tipo === "ENTRADA") {
      entradaAbierta = marca.momento;
    } else if (marca.tipo === "SALIDA" && entradaAbierta) {
      totalMs += marca.momento.getTime() - entradaAbierta.getTime();
      entradaAbierta = null;
    }
  }
  return Math.round((totalMs / 3_600_000) * 100) / 100;
}

export async function listarHorasTrabajadas(filtros: {
  empleadoId?: string;
  desde?: Date;
  hasta?: Date;
}): Promise<HorasTrabajadasEmpleado[]> {
  const empleados = await prisma.empleado.findMany({
    where: filtros.empleadoId ? { id: filtros.empleadoId } : undefined,
    include: {
      usuario: true,
      marcas: {
        where: {
          momento: filtros.desde || filtros.hasta ? { gte: filtros.desde, lte: filtros.hasta } : undefined,
        },
        orderBy: { momento: "asc" },
      },
    },
  });

  return empleados.map((empleado) => ({
    empleadoId: empleado.id,
    empleadoNombre: empleado.usuario.nombre,
    puesto: empleado.puesto,
    sueldo: empleado.sueldo,
    horas: calcularHoras(empleado.marcas),
    marcas: empleado.marcas.map((m) => toMarcaDTO(m, empleado.usuario.nombre)),
  }));
}

/** Un empleado viendo sus propias horas — nunca las de otro. Reusa
 * listarHorasTrabajadas pero primero resuelve el Empleado a partir de quién
 * está logueado, no de un id que llegue del cliente. */
export async function obtenerMisHoras(
  usuarioId: string,
  filtros: { desde?: Date; hasta?: Date },
): Promise<HorasTrabajadasEmpleado> {
  const empleado = await obtenerEmpleadoPorUsuario(usuarioId);
  // Filtrando por un empleadoId puntual que ya sabemos que existe,
  // listarHorasTrabajadas siempre devuelve exactamente esa una fila.
  const [fila] = await listarHorasTrabajadas({ empleadoId: empleado.id, desde: filtros.desde, hasta: filtros.hasta });
  return fila;
}

export async function generarExcelNomina(desde: Date, hasta: Date): Promise<ExcelJS.Buffer> {
  const filas = await listarHorasTrabajadas({ desde, hasta });
  const config = await prisma.configuracion.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = config.nombreNegocio;
  const hoja = workbook.addWorksheet("Nómina");
  hoja.addRow([config.nombreNegocio]);
  hoja.addRow([`Asistencia del ${desde.toLocaleDateString("es-BO")} al ${hasta.toLocaleDateString("es-BO")}`]);
  hoja.addRow([]);
  hoja.addRow(["Empleado", "Puesto", "Sueldo mensual", "Horas trabajadas"]);
  for (const fila of filas) {
    hoja.addRow([fila.empleadoNombre, fila.puesto, fila.sueldo, fila.horas]);
  }
  hoja.columns.forEach((col) => (col.width = 22));

  return workbook.xlsx.writeBuffer();
}
