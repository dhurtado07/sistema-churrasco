import { beforeEach, describe, expect, it, vi } from "vitest";

interface MovimientoFalso {
  turnoId: string;
  categoria: string;
  pedidoId: number | null;
  tipo: "INGRESO" | "EGRESO";
  monto: number;
  metodoPago: string;
  anulado: boolean;
  anulaMovimientoId: string | null;
}

const estado = vi.hoisted(() => ({ movimientos: [] as MovimientoFalso[] }));

// Prisma simulado: findMany aplica de verdad los filtros de igualdad del
// `where`, así el test verifica el resultado observable (efectivo esperado)
// y no solo que se haya llamado a la base con ciertos argumentos.
vi.mock("../../db.js", () => ({
  prisma: {
    cajaTurno: {
      findUnique: async () => ({ id: "t1", estado: "ABIERTO", fondoInicial: 100 }),
      findMany: async () => [
        {
          id: "t1",
          abiertoPor: { nombre: "Caja" },
          cerradoPor: null,
          fondoInicial: 100,
          abiertoEn: new Date(),
          estado: "ABIERTO",
          cerradoEn: null,
          notaCierre: null,
          efectivoContado: null,
          efectivoEsperado: null,
          diferencia: null,
        },
      ],
      update: async ({ data }: { data: Record<string, unknown> }) => ({
        id: "t1",
        abiertoPor: { nombre: "Caja" },
        cerradoPor: { nombre: "Caja" },
        fondoInicial: 100,
        abiertoEn: new Date(),
        estado: "CERRADO",
        cerradoEn: new Date(),
        notaCierre: null,
        efectivoContado: null,
        efectivoEsperado: null,
        diferencia: null,
        ...data,
      }),
    },
    movimientoCaja: {
      groupBy: async () => {
        const acumulado = new Map<string, number>();
        for (const m of estado.movimientos.filter((x) => !x.anulado && x.anulaMovimientoId === null && x.categoria === "VENTA" && x.tipo === "INGRESO")) {
          acumulado.set(m.metodoPago, (acumulado.get(m.metodoPago) ?? 0) + m.monto);
        }
        return [...acumulado.entries()].map(([metodoPago, monto]) => ({ turnoId: "t1", metodoPago, _sum: { monto } }));
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        estado.movimientos.filter((m) =>
          Object.entries(where).every(([campo, valor]) => (m as unknown as Record<string, unknown>)[campo] === valor),
        ),
    },
  },
}));

import { cerrarTurno, listarTurnos, obtenerResumenTurno } from "./service.js";

let siguientePedido = 1;

function movimiento(parcial: Partial<MovimientoFalso>): MovimientoFalso {
  return {
    turnoId: "t1",
    categoria: "VENTA",
    pedidoId: siguientePedido++,
    tipo: "INGRESO",
    monto: 0,
    metodoPago: "EFECTIVO",
    anulado: false,
    anulaMovimientoId: null,
    ...parcial,
  };
}

describe("cerrarTurno: efectivo esperado", () => {
  beforeEach(() => {
    estado.movimientos = [];
  });

  it("suma ventas en efectivo y resta egresos reales al fondo inicial", async () => {
    estado.movimientos = [movimiento({ tipo: "INGRESO", monto: 50 }), movimiento({ tipo: "EGRESO", monto: 10 })];
    const turno = await cerrarTurno("t1", "u1", 140);
    expect(turno.efectivoEsperado).toBe(140); // 100 + 50 - 10
    expect(turno.diferencia).toBe(0);
  });

  it("una venta cancelada (original anulado + su reverso) no altera el efectivo esperado", async () => {
    estado.movimientos = [
      movimiento({ tipo: "INGRESO", monto: 80 }),
      movimiento({ tipo: "INGRESO", monto: 50, anulado: true }),
      movimiento({ tipo: "EGRESO", monto: 50, anulaMovimientoId: "original" }),
    ];
    const turno = await cerrarTurno("t1", "u1", 180);
    expect(turno.efectivoEsperado).toBe(180); // 100 + 80, la venta cancelada no cuenta
    expect(turno.diferencia).toBe(0);
  });

  it("un cierre exacto con decimales da diferencia 0, sin ruido de coma flotante", async () => {
    estado.movimientos = [
      movimiento({ tipo: "INGRESO", monto: 12.1 }),
      movimiento({ tipo: "INGRESO", monto: 7.3 }),
      movimiento({ tipo: "EGRESO", monto: 4.4 }),
    ];
    const turno = await cerrarTurno("t1", "u1", 115);
    expect(turno.efectivoEsperado).toBe(115);
    expect(turno.diferencia).toBe(0);
  });

  it("si se cuenta de más, la diferencia es positiva (sobrante)", async () => {
    const turno = await cerrarTurno("t1", "u1", 200);
    expect(turno.efectivoEsperado).toBe(100);
    expect(turno.diferencia).toBe(100);
  });

  it("ignora movimientos que no son en efectivo", async () => {
    estado.movimientos = [movimiento({ tipo: "INGRESO", monto: 200, metodoPago: "TARJETA" })];
    const turno = await cerrarTurno("t1", "u1", 100);
    expect(turno.efectivoEsperado).toBe(100);
  });
});

describe("obtenerResumenTurno: lo que ve el cajero antes de contar", () => {
  beforeEach(() => {
    estado.movimientos = [];
  });

  it("junta lo vendido por método de pago y cuánto efectivo debería haber", async () => {
    estado.movimientos = [
      movimiento({ tipo: "INGRESO", monto: 37 }),
      movimiento({ tipo: "INGRESO", monto: 53 }),
      movimiento({ tipo: "INGRESO", monto: 40, metodoPago: "QR" }),
      movimiento({ tipo: "EGRESO", monto: 10, categoria: "COMPRA_INSUMO", pedidoId: null }),
    ];
    const resumen = await obtenerResumenTurno("t1");
    expect(resumen.cantidadVentas).toBe(3);
    expect(resumen.totalVendido).toBe(130);
    expect(resumen.ventasEfectivo).toBe(90);
    expect(resumen.ventasPorMetodo).toEqual(
      expect.arrayContaining([
        { metodoPago: "EFECTIVO", cantidad: 2, total: 90 },
        { metodoPago: "QR", cantidad: 1, total: 40 },
      ]),
    );
    expect(resumen.egresosEfectivo).toBe(10);
    expect(resumen.efectivoEsperado).toBe(180); // 100 de fondo + 90 en efectivo - 10 de egreso; el QR no entra
  });

  it("una venta cancelada no cuenta como vendida ni como egreso", async () => {
    estado.movimientos = [
      movimiento({ tipo: "INGRESO", monto: 60 }),
      movimiento({ tipo: "INGRESO", monto: 50, anulado: true }),
      movimiento({ tipo: "EGRESO", monto: 50, anulaMovimientoId: "original" }),
    ];
    const resumen = await obtenerResumenTurno("t1");
    expect(resumen.cantidadVentas).toBe(1);
    expect(resumen.totalVendido).toBe(60);
    expect(resumen.efectivoEsperado).toBe(160);
  });
});

describe("listarTurnos: historial con lo vendido por método de pago", () => {
  beforeEach(() => {
    estado.movimientos = [];
  });

  it("muestra cuánto entró por QR y por efectivo en cada turno", async () => {
    estado.movimientos = [
      movimiento({ tipo: "INGRESO", monto: 110 }),
      movimiento({ tipo: "INGRESO", monto: 45, metodoPago: "QR" }),
      movimiento({ tipo: "INGRESO", monto: 30, anulado: true, metodoPago: "QR" }),
    ];
    const [turno] = await listarTurnos({});
    expect(turno.totalVendido).toBe(155); // la venta anulada no cuenta
    expect(turno.ventasPorMetodo).toEqual({ EFECTIVO: 110, QR: 45 });
  });
});

describe("cerrarTurno: verificación a mano de QR/tarjeta/transferencia", () => {
  beforeEach(() => {
    estado.movimientos = [];
  });

  it("guarda lo que el cajero vio en su app y la diferencia contra lo que registró el sistema", async () => {
    estado.movimientos = [movimiento({ tipo: "INGRESO", monto: 45, metodoPago: "QR" })];
    const turno = await cerrarTurno("t1", "u1", 100, undefined, { QR: 40 });
    expect(turno.conteoOtrosMetodos).toEqual({ QR: { esperado: 45, contado: 40, diferencia: -5 } });
    // El QR no toca el efectivo esperado.
    expect(turno.efectivoEsperado).toBe(100);
  });

  it("no guarda nada de los medios que el cajero no verificó", async () => {
    estado.movimientos = [movimiento({ tipo: "INGRESO", monto: 45, metodoPago: "QR" })];
    const turno = await cerrarTurno("t1", "u1", 100);
    expect(turno.conteoOtrosMetodos ?? null).toBeNull();
  });

  it("el resumen ofrece verificar cada medio que tuvo movimientos", async () => {
    estado.movimientos = [
      movimiento({ tipo: "INGRESO", monto: 45, metodoPago: "QR" }),
      movimiento({ tipo: "INGRESO", monto: 20, metodoPago: "TRANSFERENCIA" }),
      movimiento({ tipo: "INGRESO", monto: 60 }),
    ];
    const resumen = await obtenerResumenTurno("t1");
    expect(resumen.otrosMetodos).toEqual(
      expect.arrayContaining([
        { metodoPago: "QR", esperado: 45 },
        { metodoPago: "TRANSFERENCIA", esperado: 20 },
      ]),
    );
    expect(resumen.otrosMetodos).toHaveLength(2); // el efectivo no entra en esta lista
  });
});
