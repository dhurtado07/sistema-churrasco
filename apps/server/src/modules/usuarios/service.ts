import type { UsuarioEstacion as UsuarioEstacionDTO, CrearUsuarioEstacionInput, ActualizarUsuarioEstacionInput, Rol } from "shared";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";

export class UsuarioValidationError extends Error {}

// "empleado" tiene su propia pantalla (/admin/empleados) con campos propios
// (puesto, sueldo, etc.) — este módulo es solo para las cuentas de estación.
const ROLES_ESTACION: Rol[] = ["cajero", "cocina", "parrilla", "entrega", "admin", "impresora"];

function toDTO(usuario: { id: string; username: string; nombre: string; rol: string; activo: boolean; createdAt: Date }): UsuarioEstacionDTO {
  return {
    id: usuario.id,
    username: usuario.username,
    nombre: usuario.nombre,
    rol: usuario.rol as Rol,
    activo: usuario.activo,
    creadoEn: usuario.createdAt.toISOString(),
  };
}

export async function listarUsuariosEstacion(): Promise<UsuarioEstacionDTO[]> {
  const usuarios = await prisma.usuario.findMany({
    where: { rol: { in: ROLES_ESTACION } },
    orderBy: { createdAt: "asc" },
  });
  return usuarios.map(toDTO);
}

export async function crearUsuarioEstacion(input: CrearUsuarioEstacionInput): Promise<UsuarioEstacionDTO> {
  const passwordHash = await bcrypt.hash(input.password, 10);
  try {
    const usuario = await prisma.usuario.create({
      data: { username: input.username, passwordHash, nombre: input.nombre, rol: input.rol },
    });
    return toDTO(usuario);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new UsuarioValidationError("Ese nombre de usuario ya está en uso.");
    }
    throw error;
  }
}

export async function actualizarUsuarioEstacion(
  id: string,
  input: ActualizarUsuarioEstacionInput,
): Promise<UsuarioEstacionDTO> {
  const actual = await prisma.usuario.findUnique({ where: { id } });
  if (!actual || !ROLES_ESTACION.includes(actual.rol as Rol)) {
    throw new UsuarioValidationError("Cuenta de estación no encontrada.");
  }

  // Salvavidas: nunca dejar el sistema sin ningún admin activo — si esta
  // cuenta es admin y se la quiere desactivar, tiene que quedar al menos
  // otra cuenta admin activa.
  if (actual.rol === "admin" && input.activo === false) {
    const otrosAdminsActivos = await prisma.usuario.count({
      where: { rol: "admin", activo: true, id: { not: id } },
    });
    if (otrosAdminsActivos === 0) {
      throw new UsuarioValidationError("No podés desactivar el último administrador activo.");
    }
  }

  const usuario = await prisma.usuario.update({
    where: { id },
    data: {
      ...(input.nombre ? { nombre: input.nombre } : {}),
      ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 10) } : {}),
      ...(input.activo !== undefined ? { activo: input.activo } : {}),
    },
  });
  return toDTO(usuario);
}
