import type {
  CajaTurno as CajaTurnoDTO,
  TurnoConVentas,
  ConteoOtrosMetodos,
  MetodoPago,
  ResumenTurno,
  MovimientoCaja as MovimientoCajaDTO,
  CrearMovimientoCajaInput,
  Pedido as PedidoDTO,
} from "shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";

/** Cliente de base de datos: el normal o el de una transacción — así el cierre
 * de turno y la entrega de pendientes pueden ir en una sola transacción. */
type Db = Prisma.TransactionClient;

const aCentavos = (n: number) => Math.round(n * 100) / 100;

export class CajaValidationError extends Error {}

/** Fragmento de `where` reutilizable: descarta los movimientos originales que
 * se anularon (ej. el ingreso de una venta cancelada) Y sus reversos — sin
 * ambas condiciones, el reverso (tipo opuesto, mismo monto) se contaría como
 * ingreso/egreso real, cuando en realidad neutraliza al original y no debería
 * afectar ningún total. Único punto de verdad: cualquier cálculo nuevo sobre
 * MovimientoCaja que sume ingresos/egresos reales debe spreadear esto (ver
 * cerrarTurno acá mismo y reporteFinanciero en reportes/service.ts). */
export const MOVIMIENTO_REAL_WHERE = { anulado: false, anulaMovimientoId: null } as const;

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
    conteoOtrosMetodos: (turno.conteoOtrosMetodos as ConteoOtrosMetodos | null) ?? null,
  };
}

const movimientoInclude = { registradoPor: true, pedido: { select: { estado: true } } } as const;
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
    pedidoEstado: (movimiento.pedido?.estado as MovimientoCajaDTO["pedidoEstado"]) ?? null,
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

/** Único punto de cálculo de las cuentas de un turno: lo usan el resumen que
 * ve el cajero antes de contar y el cierre mismo, para que nunca difieran.
 * Una venta cuenta desde que se cobra (al imprimir el ticket), no cuando se
 * entrega; y una venta anulada no cuenta (ver MOVIMIENTO_REAL_WHERE). */
export async function calcularResumenTurno(
  turnoId: string,
  fondoInicial: number,
  db: Db = prisma,
): Promise<Omit<ResumenTurno, "pedidosSinEntregar">> {
  const movimientos = await db.movimientoCaja.findMany({ where: { turnoId, ...MOVIMIENTO_REAL_WHERE } });

  const ventas = movimientos.filter((m) => m.categoria === "VENTA" && m.tipo === "INGRESO");
  const porMetodo = new Map<MetodoPago, { cantidad: number; total: number }>();
  for (const venta of ventas) {
    const metodo = (venta.metodoPago ?? "EFECTIVO") as MetodoPago;
    const acumulado = porMetodo.get(metodo) ?? { cantidad: 0, total: 0 };
    porMetodo.set(metodo, { cantidad: acumulado.cantidad + 1, total: acumulado.total + venta.monto });
  }

  const enEfectivo = movimientos.filter((m) => m.metodoPago === "EFECTIVO");
  const ingresosEfectivo = enEfectivo.filter((m) => m.tipo === "INGRESO").reduce((s, m) => s + m.monto, 0);
  const ventasEfectivo = porMetodo.get("EFECTIVO")?.total ?? 0;
  const egresosEfectivo = enEfectivo.filter((m) => m.tipo === "EGRESO").reduce((s, m) => s + m.monto, 0);

  return {
    fondoInicial,
    cantidadVentas: new Set(ventas.map((v) => v.pedidoId)).size,
    totalVendido: ventas.reduce((s, v) => s + v.monto, 0),
    ventasPorMetodo: [...porMetodo.entries()].map(([metodoPago, v]) => ({ metodoPago, ...v })),
    ventasEfectivo,
    otrosIngresosEfectivo: ingresosEfectivo - ventasEfectivo,
    egresosEfectivo,
    efectivoEsperado: aCentavos(fondoInicial + ingresosEfectivo - egresosEfectivo),
    otrosMetodos: metodosNoEfectivo(movimientos),
  };
}

/** Neto (ingresos - egresos) de cada medio que no es efectivo con movimientos:
 * es lo que el cajero debería ver en su app para ese medio. */
function metodosNoEfectivo(
  movimientos: { tipo: string; monto: number; metodoPago: string | null }[],
): ResumenTurno["otrosMetodos"] {
  const neto = new Map<Exclude<MetodoPago, "EFECTIVO">, number>();
  for (const m of movimientos) {
    if (!m.metodoPago || m.metodoPago === "EFECTIVO") continue;
    const metodo = m.metodoPago as Exclude<MetodoPago, "EFECTIVO">;
    neto.set(metodo, (neto.get(metodo) ?? 0) + (m.tipo === "INGRESO" ? m.monto : -m.monto));
  }
  return [...neto.entries()].map(([metodoPago, esperado]) => ({ metodoPago, esperado }));
}

export async function obtenerResumenTurno(turnoId: string): Promise<Omit<ResumenTurno, "pedidosSinEntregar">> {
  const turno = await prisma.cajaTurno.findUnique({ where: { id: turnoId } });
  if (!turno) throw new CajaValidationError("Turno no encontrado");
  return calcularResumenTurno(turnoId, turno.fondoInicial);
}

export async function cerrarTurno(
  turnoId: string,
  usuarioId: string,
  efectivoContado: number,
  notaCierre?: string,
  otrosMetodosContados: Partial<Record<Exclude<MetodoPago, "EFECTIVO">, number>> = {},
  db: Db = prisma,
): Promise<CajaTurnoDTO> {
  const turno = await db.cajaTurno.findUnique({ where: { id: turnoId } });
  if (!turno) throw new CajaValidationError("Turno no encontrado");
  if (turno.estado !== "ABIERTO") throw new CajaValidationError("Este turno ya está cerrado.");

  const resumen = await calcularResumenTurno(turnoId, turno.fondoInicial, db);
  const { efectivoEsperado } = resumen;
  // A centavos: sumar decimales en float deja ruido (1.4e-14) y un cierre
  // exacto se vería como "sobran Bs 0,00".
  const diferencia = aCentavos(efectivoContado - efectivoEsperado);

  // Solo se guarda lo que el cajero verificó; el esperado sale del sistema.
  const conteoOtrosMetodos: ConteoOtrosMetodos = {};
  for (const { metodoPago, esperado } of resumen.otrosMetodos) {
    const contado = otrosMetodosContados[metodoPago];
    if (contado === undefined) continue;
    conteoOtrosMetodos[metodoPago] = { esperado, contado, diferencia: aCentavos(contado - esperado) };
  }

  const cerrado = await db.cajaTurno.update({
    where: { id: turnoId },
    data: {
      estado: "CERRADO",
      cerradoPorId: usuarioId,
      efectivoContado,
      efectivoEsperado,
      diferencia,
      notaCierre: notaCierre ?? null,
      cerradoEn: new Date(),
      conteoOtrosMetodos: Object.keys(conteoOtrosMetodos).length > 0 ? conteoOtrosMetodos : undefined,
    },
    include: turnoInclude,
  });
  return toTurnoDTO(cerrado);
}

/** Turnos abiertos dentro del rango (más recientes primero) — para ver con
 * cuánto se abrió cada caja y cómo cerró, incluso los ya cerrados. */
export async function listarTurnos(rango: { desde?: Date; hasta?: Date }): Promise<TurnoConVentas[]> {
  const turnos = await prisma.cajaTurno.findMany({
    where: {
      abiertoEn: {
        ...(rango.desde ? { gte: rango.desde } : {}),
        ...(rango.hasta ? { lte: rango.hasta } : {}),
      },
    },
    include: turnoInclude,
    orderBy: { abiertoEn: "desc" },
    take: 200,
  });

  // Lo vendido por turno y método de pago, en una sola consulta (no una por turno).
  const ventas = await prisma.movimientoCaja.groupBy({
    by: ["turnoId", "metodoPago"],
    where: { turnoId: { in: turnos.map((t) => t.id) }, ...MOVIMIENTO_REAL_WHERE, categoria: "VENTA", tipo: "INGRESO" },
    _sum: { monto: true },
  });
  const ventasDe = (turnoId: string) => {
    const porMetodo: TurnoConVentas["ventasPorMetodo"] = {};
    for (const v of ventas.filter((x) => x.turnoId === turnoId)) {
      const metodo = (v.metodoPago ?? "EFECTIVO") as MetodoPago;
      porMetodo[metodo] = (porMetodo[metodo] ?? 0) + (v._sum.monto ?? 0);
    }
    return porMetodo;
  };

  return turnos.map((t) => {
    const ventasPorMetodo = ventasDe(t.id);
    const totalVendido = Object.values(ventasPorMetodo).reduce((s, monto) => s + (monto ?? 0), 0);
    return { ...toTurnoDTO(t), totalVendido, ventasPorMetodo };
  });
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
  // Solo para sincronizar una venta hecha sin conexión: el turno y la hora
  // real de cuando pasó, en vez del turno abierto ahora mismo y la hora
  // actual (ver crearPedido#resolverTurnoParaVenta).
  overrides?: { turnoId?: string; creadoEn?: Date },
): Promise<MovimientoCajaDTO> {
  const turnoId =
    overrides?.turnoId ?? (await prisma.cajaTurno.findFirst({ where: { estado: "ABIERTO" } }))?.id ?? null;
  const movimiento = await prisma.movimientoCaja.create({
    data: {
      turnoId,
      tipo: input.tipo,
      categoria: input.categoria,
      concepto: input.concepto,
      monto: input.monto,
      metodoPago: input.metodoPago ?? null,
      pedidoId: refs.pedidoId ?? null,
      compraId: refs.compraId ?? null,
      anulaMovimientoId: refs.anulaMovimientoId ?? null,
      registradoPorId: usuarioId,
      ...(overrides?.creadoEn ? { creadoEn: overrides.creadoEn } : {}),
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

export async function registrarVentaPedido(
  pedido: PedidoDTO,
  usuarioId: string,
  overrides?: { turnoId?: string; creadoEn?: Date },
): Promise<MovimientoCajaDTO> {
  return registrarMovimiento(
    {
      tipo: "INGRESO",
      categoria: "VENTA",
      concepto: `Venta ticket #${pedido.numeroTicket}`,
      monto: pedido.total,
      metodoPago: pedido.metodoPago,
    },
    usuarioId,
    { pedidoId: pedido.folio },
    overrides,
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
