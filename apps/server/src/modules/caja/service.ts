import type {
  CajaTurno as CajaTurnoDTO,
  MovimientoCaja as MovimientoCajaDTO,
  CrearMovimientoCajaInput,
  Pedido as PedidoDTO,
} from "shared";
import { prisma } from "../../db.js";

export class CajaValidationError extends Error {}

const turnoInclude = { abiertoPor: true, cerradoPor: true } as const;
type TurnoConRelaciones = Awaited<
  ReturnType<typeof prisma.cajaTurno.findFirstOrThrow<{ include: typeof turnoInclude }>>
>;

function toTurnoDTO(turno: TurnoConRelaciones): CajaTurnoDTO {
  return {
    id: turno.id,
    abiertoPorNombre: turno.abiertoPor.nombre,
    fondoInicial: turno.fondoInicial,
    abiertoEn: turno.abiertoEn.toISOString(),
    estado: turno.estado as CajaTurnoDTO["estado"],
    cerradoPorNombre: turno.cerradoPor?.nombre ?? null,
    efectivoContado: turno.efectivoContado,
    efectivoEsperado: turno.efectivoEsperado,
    diferencia: turno.diferencia,
    notaCierre: turno.notaCierre,
    cerradoEn: turno.cerradoEn ? turno.cerradoEn.toISOString() : null,
  };
}

const movimientoInclude = { registradoPor: true } as const;
type MovimientoConRelaciones = Awaited<
  ReturnType<typeof prisma.movimientoCaja.findFirstOrThrow<{ include: typeof movimientoInclude }>>
>;

function toMovimientoDTO(movimiento: MovimientoConRelaciones): MovimientoCajaDTO {
  return {
    id: movimiento.id,
    turnoId: movimiento.turnoId,
    tipo: movimiento.tipo as MovimientoCajaDTO["tipo"],
    categoria: movimiento.categoria as MovimientoCajaDTO["categoria"],
    concepto: movimiento.concepto,
    monto: movimiento.monto,
    metodoPago: movimiento.metodoPago as MovimientoCajaDTO["metodoPago"],
    pedidoId: movimiento.pedidoId,
    compraId: movimiento.compraId,
    registradoPorNombre: movimiento.registradoPor.nombre,
    anulaMovimientoId: movimiento.anulaMovimientoId,
    anulado: movimiento.anulado,
    creadoEn: movimiento.creadoEn.toISOString(),
  };
}

export async function obtenerTurnoActivo(): Promise<CajaTurnoDTO | null> {
  const turno = await prisma.cajaTurno.findFirst({
    where: { estado: "ABIERTO" },
    include: turnoInclude,
    orderBy: { abiertoEn: "desc" },
  });
  return turno ? toTurnoDTO(turno) : null;
}

export async function abrirTurno(usuarioId: string, fondoInicial: number): Promise<CajaTurnoDTO> {
  const abierto = await prisma.cajaTurno.findFirst({ where: { estado: "ABIERTO" } });
  if (abierto) throw new CajaValidationError("Ya hay un turno de caja abierto.");

  const turno = await prisma.cajaTurno.create({
    data: { abiertoPorId: usuarioId, fondoInicial },
    include: turnoInclude,
  });
  return toTurnoDTO(turno);
}

export async function cerrarTurno(
  turnoId: string,
  usuarioId: string,
  efectivoContado: number,
  notaCierre?: string,
): Promise<CajaTurnoDTO> {
  const turno = await prisma.cajaTurno.findUnique({ where: { id: turnoId } });
  if (!turno) throw new CajaValidationError("Turno no encontrado");
  if (turno.estado !== "ABIERTO") throw new CajaValidationError("Este turno ya está cerrado.");

  const movimientos = await prisma.movimientoCaja.findMany({
    where: { turnoId, anulado: false, metodoPago: "EFECTIVO" },
  });
  const ingresosEfectivo = movimientos.filter((m) => m.tipo === "INGRESO").reduce((sum, m) => sum + m.monto, 0);
  const egresosEfectivo = movimientos.filter((m) => m.tipo === "EGRESO").reduce((sum, m) => sum + m.monto, 0);
  const efectivoEsperado = turno.fondoInicial + ingresosEfectivo - egresosEfectivo;
  const diferencia = efectivoContado - efectivoEsperado;

  const cerrado = await prisma.cajaTurno.update({
    where: { id: turnoId },
    data: {
      estado: "CERRADO",
      cerradoPorId: usuarioId,
      efectivoContado,
      efectivoEsperado,
      diferencia,
      notaCierre: notaCierre ?? null,
      cerradoEn: new Date(),
    },
    include: turnoInclude,
  });
  return toTurnoDTO(cerrado);
}

export async function listarMovimientos(filtros: {
  turnoId?: string;
  desde?: Date;
  hasta?: Date;
}): Promise<MovimientoCajaDTO[]> {
  const movimientos = await prisma.movimientoCaja.findMany({
    where: {
      turnoId: filtros.turnoId,
      creadoEn:
        filtros.desde || filtros.hasta
          ? { gte: filtros.desde, lte: filtros.hasta }
          : undefined,
    },
    include: movimientoInclude,
    orderBy: { creadoEn: "desc" },
    take: 300,
  });
  return movimientos.map(toMovimientoDTO);
}

export async function registrarMovimientoManual(
  input: CrearMovimientoCajaInput,
  usuarioId: string,
): Promise<MovimientoCajaDTO> {
  return registrarMovimiento(input, usuarioId, {});
}

async function registrarMovimiento(
  input: {
    tipo: "INGRESO" | "EGRESO";
    categoria: MovimientoCajaDTO["categoria"];
    concepto: string;
    monto: number;
    metodoPago?: MovimientoCajaDTO["metodoPago"] | null;
  },
  usuarioId: string,
  refs: { pedidoId?: number; compraId?: string; anulaMovimientoId?: string },
): Promise<MovimientoCajaDTO> {
  const turnoActivo = await prisma.cajaTurno.findFirst({ where: { estado: "ABIERTO" } });
  const movimiento = await prisma.movimientoCaja.create({
    data: {
      turnoId: turnoActivo?.id ?? null,
      tipo: input.tipo,
      categoria: input.categoria,
      concepto: input.concepto,
      monto: input.monto,
      metodoPago: input.metodoPago ?? null,
      pedidoId: refs.pedidoId ?? null,
      compraId: refs.compraId ?? null,
      anulaMovimientoId: refs.anulaMovimientoId ?? null,
      registradoPorId: usuarioId,
    },
    include: movimientoInclude,
  });
  return toMovimientoDTO(movimiento);
}

/** El movimiento original nunca se edita ni se borra: anular crea un
 * movimiento reverso (tipo opuesto, mismo monto) que lo neutraliza en los
 * totales, y marca el original como `anulado` para que quede claro en el
 * libro qué pasó — todo queda documentado para una auditoría o para que lo
 * tome una contadora tal cual. */
export async function anularMovimiento(id: string, usuarioId: string): Promise<MovimientoCajaDTO> {
  const original = await prisma.movimientoCaja.findUnique({ where: { id } });
  if (!original) throw new CajaValidationError("Movimiento no encontrado");
  if (original.anulado) throw new CajaValidationError("Este movimiento ya fue anulado.");

  const yaReversado = await prisma.movimientoCaja.findUnique({ where: { anulaMovimientoId: id } });
  if (yaReversado) throw new CajaValidationError("Este movimiento ya tiene un reverso registrado.");

  const reverso = await registrarMovimiento(
    {
      tipo: original.tipo === "INGRESO" ? "EGRESO" : "INGRESO",
      categoria: original.categoria as MovimientoCajaDTO["categoria"],
      concepto: `Reverso: ${original.concepto}`,
      monto: original.monto,
      metodoPago: original.metodoPago as MovimientoCajaDTO["metodoPago"] | null,
    },
    usuarioId,
    {
      pedidoId: original.pedidoId ?? undefined,
      compraId: original.compraId ?? undefined,
      anulaMovimientoId: original.id,
    },
  );

  await prisma.movimientoCaja.update({ where: { id }, data: { anulado: true } });
  return reverso;
}

// ---------------------------------------------------------------------------
// Usado internamente por el módulo de pedidos: cada venta cobrada en caja
// genera automáticamente su ingreso en el libro; si el pedido se edita o
// cancela, el ingreso original se anula (nunca se reescribe) y, si aplica,
// se registra uno nuevo con el monto correcto.
// ---------------------------------------------------------------------------

export async function registrarVentaPedido(pedido: PedidoDTO, usuarioId: string): Promise<MovimientoCajaDTO> {
  return registrarMovimiento(
    {
      tipo: "INGRESO",
      categoria: "VENTA",
      concepto: `Venta pedido #${pedido.folio}`,
      monto: pedido.total,
      metodoPago: pedido.metodoPago,
    },
    usuarioId,
    { pedidoId: pedido.folio },
  );
}

async function anularVentaVigente(folio: number, usuarioId: string): Promise<MovimientoCajaDTO | null> {
  const vigente = await prisma.movimientoCaja.findFirst({
    where: { pedidoId: folio, categoria: "VENTA", tipo: "INGRESO", anulado: false },
  });
  return vigente ? anularMovimiento(vigente.id, usuarioId) : null;
}

export async function reemplazarVentaPedido(pedido: PedidoDTO, usuarioId: string): Promise<MovimientoCajaDTO> {
  await anularVentaVigente(pedido.folio, usuarioId);
  return registrarVentaPedido(pedido, usuarioId);
}

export async function anularVentaPedido(folio: number, usuarioId: string): Promise<MovimientoCajaDTO | null> {
  return anularVentaVigente(folio, usuarioId);
}

// ---------------------------------------------------------------------------
// Usado internamente por el módulo de compras: cada compra de insumos genera
// automáticamente su egreso en el libro de caja.
// ---------------------------------------------------------------------------

export async function registrarEgresoCompra(
  compraId: string,
  total: number,
  proveedorNombre: string | null,
  usuarioId: string,
): Promise<MovimientoCajaDTO> {
  return registrarMovimiento(
    {
      tipo: "EGRESO",
      categoria: "COMPRA_INSUMO",
      concepto: proveedorNombre ? `Compra a ${proveedorNombre}` : "Compra de insumos",
      monto: total,
      metodoPago: null,
    },
    usuarioId,
    { compraId },
  );
}
