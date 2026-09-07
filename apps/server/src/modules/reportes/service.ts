import type {
  ReporteGanancias,
  ReporteFinanciero,
  CategoriaMovimientoCaja,
  MetodoPago,
  PuntoSerieFinanciera,
} from "shared";
import ExcelJS from "exceljs";
import { prisma } from "../../db.js";

function inicioFinDelDia(fecha: Date): { desde: Date; hasta: Date } {
  const desde = new Date(fecha);
  desde.setHours(0, 0, 0, 0);
  const hasta = new Date(desde);
  hasta.setDate(hasta.getDate() + 1);
  return { desde, hasta };
}

export async function reporteGanancias(fecha: Date): Promise<ReporteGanancias> {
  const { desde, hasta } = inicioFinDelDia(fecha);

  const pedidos = await prisma.pedido.findMany({
    // La venta ya está cerrada apenas cocina y parrilla terminan (COMPLETADO);
    // que después pase a ENTREGADO es solo el paso logístico de entrega y no
    // debe hacer que el pedido "desaparezca" de las ganancias del día.
    where: { estado: { in: ["COMPLETADO", "ENTREGADO"] }, completadoEn: { gte: desde, lt: hasta } },
    include: { items: { include: { extras: true } } },
  });

  const porProductoMap = new Map<string, { productoId: string; nombre: string; cantidad: number; total: number }>();
  const porTipoConsumo: Record<"LOCAL" | "LLEVAR", number> = { LOCAL: 0, LLEVAR: 0 };
  let totalVendido = 0;

  for (const pedido of pedidos) {
    totalVendido += pedido.total;
    porTipoConsumo[pedido.tipoConsumo as "LOCAL" | "LLEVAR"] += pedido.total;

    for (const item of pedido.items) {
      const extrasTotal = item.extras.reduce((sum, extra) => sum + extra.precio, 0);
      const itemTotal = (item.precioUnitario + extrasTotal) * item.cantidad;
      const actual = porProductoMap.get(item.productoId) ?? {
        productoId: item.productoId,
        nombre: item.nombreProducto,
        cantidad: 0,
        total: 0,
      };
      actual.cantidad += item.cantidad;
      actual.total += itemTotal;
      porProductoMap.set(item.productoId, actual);
    }
  }

  return {
    fecha: desde.toISOString().slice(0, 10),
    totalVendido,
    cantidadPedidos: pedidos.length,
    porTipoConsumo,
    porProducto: [...porProductoMap.values()].sort((a, b) => b.total - a.total),
  };
}

export const reporteGananciasDeHoy = () => reporteGanancias(new Date());

// ---------------------------------------------------------------------------
// Reporte financiero — ingresos vs. egresos vs. inversión, filtrable por
// rango de fechas (día/semana/mes/año o un rango a medida) y con serie de
// tiempo para graficar.
// ---------------------------------------------------------------------------

function claveBucket(fecha: Date, agrupar: "dia" | "semana" | "mes"): string {
  if (agrupar === "mes") return fecha.toISOString().slice(0, 7);
  if (agrupar === "semana") {
    const inicio = new Date(fecha);
    const diaSemana = (inicio.getDay() + 6) % 7; // lunes = 0
    inicio.setDate(inicio.getDate() - diaSemana);
    return inicio.toISOString().slice(0, 10);
  }
  return fecha.toISOString().slice(0, 10);
}

export async function reporteFinanciero(
  desde: Date,
  hasta: Date,
  agrupar: "dia" | "semana" | "mes" = "dia",
): Promise<ReporteFinanciero> {
  const [movimientos, pedidos] = await Promise.all([
    prisma.movimientoCaja.findMany({
      where: { anulado: false, creadoEn: { gte: desde, lte: hasta } },
      orderBy: { creadoEn: "asc" },
    }),
    // Mismo criterio que reporteGanancias: la venta ya cuenta apenas cocina y
    // parrilla terminan (COMPLETADO), sin esperar a que Entrega la confirme.
    prisma.pedido.findMany({
      where: { estado: { in: ["COMPLETADO", "ENTREGADO"] }, completadoEn: { gte: desde, lte: hasta } },
      include: { items: { include: { extras: true } } },
    }),
  ]);

  let totalIngresos = 0;
  let totalEgresos = 0;
  let totalInversionInsumos = 0;
  const porCategoriaMap = new Map<CategoriaMovimientoCaja, number>();
  const porMetodoPagoMap = new Map<MetodoPago, number>();
  const serieMap = new Map<string, PuntoSerieFinanciera>();

  for (const m of movimientos) {
    const categoria = m.categoria as CategoriaMovimientoCaja;
    if (m.tipo === "INGRESO") {
      totalIngresos += m.monto;
      if (m.metodoPago) {
        const metodo = m.metodoPago as MetodoPago;
        porMetodoPagoMap.set(metodo, (porMetodoPagoMap.get(metodo) ?? 0) + m.monto);
      }
    } else {
      totalEgresos += m.monto;
      porCategoriaMap.set(categoria, (porCategoriaMap.get(categoria) ?? 0) + m.monto);
      if (categoria === "COMPRA_INSUMO") totalInversionInsumos += m.monto;
    }

    const clave = claveBucket(m.creadoEn, agrupar);
    const punto = serieMap.get(clave) ?? { etiqueta: clave, ingresos: 0, egresos: 0, ganancia: 0 };
    if (m.tipo === "INGRESO") punto.ingresos += m.monto;
    else punto.egresos += m.monto;
    punto.ganancia = punto.ingresos - punto.egresos;
    serieMap.set(clave, punto);
  }

  const porTipoConsumo: Record<"LOCAL" | "LLEVAR", number> = { LOCAL: 0, LLEVAR: 0 };
  const porProductoMap = new Map<string, { productoId: string; nombre: string; cantidad: number; total: number }>();
  for (const pedido of pedidos) {
    porTipoConsumo[pedido.tipoConsumo as "LOCAL" | "LLEVAR"] += pedido.total;
    for (const item of pedido.items) {
      const extrasTotal = item.extras.reduce((sum, extra) => sum + extra.precio, 0);
      const itemTotal = (item.precioUnitario + extrasTotal) * item.cantidad;
      const actual = porProductoMap.get(item.productoId) ?? {
        productoId: item.productoId,
        nombre: item.nombreProducto,
        cantidad: 0,
        total: 0,
      };
      actual.cantidad += item.cantidad;
      actual.total += itemTotal;
      porProductoMap.set(item.productoId, actual);
    }
  }

  return {
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    totalIngresos,
    totalEgresos,
    totalInversionInsumos,
    gananciaNeta: totalIngresos - totalEgresos,
    porCategoriaEgreso: [...porCategoriaMap.entries()].map(([categoria, total]) => ({ categoria, total })),
    porMetodoPago: [...porMetodoPagoMap.entries()].map(([metodoPago, total]) => ({ metodoPago, total })),
    serie: [...serieMap.values()].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta)),
    porTipoConsumo,
    // Top 8 — un dashboard no necesita el catálogo entero, solo lo que más pesa.
    porProducto: [...porProductoMap.values()].sort((a, b) => b.total - a.total).slice(0, 8),
  };
}

export async function generarExcelFinanciero(desde: Date, hasta: Date, agrupar: "dia" | "semana" | "mes"): Promise<ExcelJS.Buffer> {
  const reporte = await reporteFinanciero(desde, hasta, agrupar);
  const movimientos = await prisma.movimientoCaja.findMany({
    where: { anulado: false, creadoEn: { gte: desde, lte: hasta } },
    include: { registradoPor: true },
    orderBy: { creadoEn: "asc" },
  });

  const config = await prisma.configuracion.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = config.nombreNegocio;

  const resumen = workbook.addWorksheet("Resumen");
  resumen.addRow([config.nombreNegocio]);
  resumen.addRow([`Reporte financiero del ${desde.toLocaleDateString("es-BO")} al ${hasta.toLocaleDateString("es-BO")}`]);
  resumen.addRow([]);
  resumen.addRow(["Total ingresos", reporte.totalIngresos]);
  resumen.addRow(["Total egresos", reporte.totalEgresos]);
  resumen.addRow(["Inversión en insumos", reporte.totalInversionInsumos]);
  resumen.addRow(["Ganancia neta", reporte.gananciaNeta]);
  resumen.addRow([]);
  resumen.addRow(["Egresos por categoría"]);
  for (const c of reporte.porCategoriaEgreso) resumen.addRow([c.categoria, c.total]);
  resumen.addRow([]);
  resumen.addRow(["Ingresos por método de pago"]);
  for (const m of reporte.porMetodoPago) resumen.addRow([m.metodoPago, m.total]);
  resumen.addRow([]);
  resumen.addRow(["Ventas por tipo de consumo"]);
  resumen.addRow(["Local", reporte.porTipoConsumo.LOCAL]);
  resumen.addRow(["Para llevar", reporte.porTipoConsumo.LLEVAR]);
  resumen.addRow([]);
  resumen.addRow(["Platos más vendidos", "Cantidad", "Total"]);
  for (const p of reporte.porProducto) resumen.addRow([p.nombre, p.cantidad, p.total]);
  resumen.getColumn(1).width = 28;

  const detalle = workbook.addWorksheet("Movimientos");
  detalle.addRow(["Fecha", "Tipo", "Categoría", "Concepto", "Monto", "Método de pago", "Registrado por"]);
  for (const m of movimientos) {
    detalle.addRow([
      m.creadoEn.toLocaleString("es-BO"),
      m.tipo,
      m.categoria,
      m.concepto,
      m.monto,
      m.metodoPago ?? "",
      m.registradoPor.nombre,
    ]);
  }
  detalle.columns.forEach((col) => (col.width = 20));

  return workbook.xlsx.writeBuffer();
}
