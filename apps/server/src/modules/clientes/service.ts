import type { Cliente } from "shared";
import { prisma } from "../../db.js";

function toClienteDTO(cliente: { id: string; nombre: string; carnet: string | null; creadoEn: Date }): Cliente {
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    carnet: cliente.carnet,
    creadoEn: cliente.creadoEn.toISOString(),
  };
}

export class ClienteValidationError extends Error {}

export async function crearCliente(input: { nombre: string; carnet?: string }): Promise<Cliente> {
  if (input.carnet) {
    const existente = await prisma.cliente.findUnique({ where: { carnet: input.carnet } });
    if (existente) {
      throw new ClienteValidationError(`Ya existe un cliente registrado con el carnet ${input.carnet}`);
    }
  }
  const cliente = await prisma.cliente.create({ data: { nombre: input.nombre, carnet: input.carnet ?? null } });
  return toClienteDTO(cliente);
}

export async function listarClientes(query?: string): Promise<Cliente[]> {
  const clientes = await prisma.cliente.findMany({
    where: query
      ? {
          OR: [
            { nombre: { contains: query } },
            { carnet: { contains: query } },
          ],
        }
      : undefined,
    orderBy: { nombre: "asc" },
    take: 25,
  });
  return clientes.map(toClienteDTO);
}
