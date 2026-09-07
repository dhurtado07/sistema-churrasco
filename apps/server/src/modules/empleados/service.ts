import type { Empleado as EmpleadoDTO, CrearEmpleadoInput, ActualizarEmpleadoInput } from "shared";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";

export class EmpleadoValidationError extends Error {}

const empleadoInclude = { usuario: true } as const;
type EmpleadoConRelaciones = Awaited<
  ReturnType<typeof prisma.empleado.findFirstOrThrow<{ include: typeof empleadoInclude }>>
>;

function toDTO(empleado: EmpleadoConRelaciones): EmpleadoDTO {
  return {
    id: empleado.id,
    usuarioId: empleado.usuarioId,
    username: empleado.usuario.username,
    nombre: empleado.usuario.nombre,
    puesto: empleado.puesto,
    sueldo: empleado.sueldo,
    fechaContratacion: empleado.fechaContratacion ? empleado.fechaContratacion.toISOString() : null,
    telefono: empleado.telefono,
    activo: empleado.activo,
    tienePin: Boolean(empleado.pinHash),
  };
}

export async function listarEmpleados(soloActivos = false): Promise<EmpleadoDTO[]> {
  const empleados = await prisma.empleado.findMany({
    where: soloActivos ? { activo: true } : undefined,
    include: empleadoInclude,
    orderBy: { createdAt: "asc" },
  });
  return empleados.map(toDTO);
}

export async function crearEmpleado(input: CrearEmpleadoInput): Promise<EmpleadoDTO> {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const pinHash = input.pin ? await bcrypt.hash(input.pin, 10) : null;
  try {
    const empleado = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: { username: input.username, passwordHash, nombre: input.nombre, rol: "empleado" },
      });
      return tx.empleado.create({
        data: {
          usuarioId: usuario.id,
          puesto: input.puesto,
          sueldo: input.sueldo,
          fechaContratacion: input.fechaContratacion ? new Date(input.fechaContratacion) : null,
          telefono: input.telefono ?? null,
          pinHash,
        },
        include: empleadoInclude,
      });
    });
    return toDTO(empleado);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new EmpleadoValidationError("Ese nombre de usuario ya está en uso.");
    }
    throw error;
  }
}

export async function actualizarEmpleado(id: string, input: ActualizarEmpleadoInput): Promise<EmpleadoDTO> {
  const empleado = await prisma.empleado.findUnique({ where: { id } });
  if (!empleado) throw new EmpleadoValidationError("Empleado no encontrado");

  const { nombre, password, pin, ...datosEmpleado } = input;
  if (nombre || password) {
    await prisma.usuario.update({
      where: { id: empleado.usuarioId },
      data: {
        ...(nombre ? { nombre } : {}),
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
        ...(input.activo !== undefined ? { activo: input.activo } : {}),
      },
    });
  } else if (input.activo !== undefined) {
    await prisma.usuario.update({ where: { id: empleado.usuarioId }, data: { activo: input.activo } });
  }

  const actualizado = await prisma.empleado.update({
    where: { id },
    data: { ...datosEmpleado, ...(pin ? { pinHash: await bcrypt.hash(pin, 10) } : {}) },
    include: empleadoInclude,
  });
  return toDTO(actualizado);
}
