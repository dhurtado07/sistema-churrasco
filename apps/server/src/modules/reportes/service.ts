import type {
  ReporteGanancias,
  ReporteFinanciero,
  CategoriaMovimientoCaja,
  MetodoPago,
  PuntoSerieFinanciera,
  VentaPorProducto,
} from "shared";
import ExcelJS from "exceljs";
import { aCentavos } from "shared";
import { prisma } from "../../db.js";
import { MOVIMIENTO_REAL_WHERE } from "../caja/service.js";

export function inicioDelDia(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function finDelDia(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
}

interface ItemVendido {
  productoId: string;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  extras: { extraId: string; nombre: string; precio: number; cantidad: number }[];
}

/** Agrupa lo vendido por plato y por extra, de mayor a menor monto. Los extras van
 * en filas propias: si se sumaran al plato, su "precio unitario" (total ÷ unidades)
 * dejaría de ser el precio del plato. */
export function ventasPorProducto(items: ItemVendido[]): VentaPorProducto[] {
  const filas = new Map<string, VentaPorProducto>();
  const sumar = (clave: string, fila: Omit<VentaPorProducto, "cantidad" | "total">, cantidad: number, total: number) => {
    const actual = filas.get(clave) ?? { ...fila, cantidad: 0, total: 0 };
    actual.cantidad += cantidad;
    actual.total = aCentavos(actual.total + total);
    filas.set(clave, actual);
  };

  for (const item of items) {
    const plato = { productoId: item.productoId, nombre: item.nombreProducto, esExtra: false };
    sumar(`producto:${item.productoId}`, plato, item.cantidad, item.precioUnitario * item.cantidad);
    for (const extra of item.extras) {
      const fila = { productoId: extra.extraId, nombre: extra.nombre, esExtra: true };
      sumar(`extra:${extra.extraId}`, fila, extra.cantidad, extra.precio * extra.cantidad);
    }
  }
  return [...filas.values()].sort((a, b) => b.total - a.total);
}

export async function reporteGanancias(desdeInput: Date, hastaInput: Date = desdeInput): Promise<ReporteGanancias> {
  const desde = inicioDelDia(desdeInput);
  const hasta = finDelDia(hastaInput);

  const pedidos = await prisma.pedido.findMany({
    // La venta cuenta desde que se cobra (PAGADO): en ese momento el dinero ya
    // entró a caja, sin importar si cocina/parrilla/entrega ya terminaron. Si
    // el cliente cancela, el pedido pasa a CANCELADO y sale solo del reporte.
    // Por eso se filtra por creadoEn (el instante del cobro) y no por
    // completadoEn, que es null mientras el pedido sigue en preparación.
    where: { estado: { in: ["PAGADO", "COMPLETADO", "ENTREGADO"] }, creadoEn: { gte: desde, lte: hasta } },
    include: { items: { include: { extras: true } } },
  });

  const porTipoConsumo: Record<"LOCAL" | "LLEVAR", number> = { LOCAL: 0, LLEVAR: 0 };
  let totalVendido = 0;

  for (const pedido of pedidos) {
    totalVendido += pedido.total;
    porTipoConsumo[pedido.tipoConsumo as "LOCAL" | "LLEVAR"] += pedido.total;
  }

  return {
    desde: fechaLocalISO(desde),
    hasta: fechaLocalISO(hasta),
    totalVendido,
    cantidadPedidos: pedidos.length,
    porTipoConsumo,
    porProducto: ventasPorProducto(pedidos.flatMap((p) => p.items)),
  };
}

export const reporteGananciasDeHoy = () => reporteGanancias(new Date());

// ---------------------------------------------------------------------------
// Reporte financiero — ingresos vs. egresos vs. inversión, filtrable por
// rango de fechas (día/semana/mes/año o un rango a medida) y con serie de
// tiempo para graficar.
// ---------------------------------------------------------------------------

/** Fecha "YYYY-MM-DD" en la hora local del negocio — NO toISOString(), que es UTC
 * y pasaría las ventas de la noche (desde las 8 pm en Bolivia) al día siguiente. */
function fechaLocalISO(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export function claveBucket(fecha: Date, agrupar: "dia" | "semana" | "mes"): string {
  if (agrupar === "mes") return fechaLocalISO(fecha).slice(0, 7);
  if (agrupar === "semana") {
    const inicio = new Date(fecha);
    const diaSemana = (inicio.getDay() + 6) % 7; // lunes = 0
    inicio.setDate(inicio.getDate() - diaSemana);
    return fechaLocalISO(inicio);
  }
  return fechaLocalISO(fecha);
}

export async function reporteFinanciero(
  desde: Date,
  hasta: Date,
  agrupar: "dia" | "semana" | "mes" = "dia",
): Promise<ReporteFinanciero> {
  const [movimientos, pedidos] = await Promise.all([
    prisma.movimientoCaja.findMany({
      // MOVIMIENTO_REAL_WHERE descarta los originales anulados (p.ej. el
      // ingreso de una venta cancelada) y sus reversos: si no, la venta
      // cancelada dejaría su reverso (tipo EGRESO) contándose como un egreso
      // real y bajando la ganancia. Excluyendo ambos, queda en cero, como si
      // nunca hubiera pasado.
      where: { ...MOVIMIENTO_REAL_WHERE, creadoEn: { gte: desde, lte: hasta } },
      orderBy: { creadoEn: "asc" },
    }),
    // Mismo criterio que reporteGanancias: la venta cuenta desde que se cobra
    // (PAGADO), por creadoEn, sin esperar a cocina/parrilla/entrega.
    prisma.pedido.findMany({
      where: { estado: { in: ["PAGADO", "COMPLETADO", "ENTREGADO"] }, creadoEn: { gte: desde, lte: hasta } },
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
  for (const pedido of pedidos) {
    porTipoConsumo[pedido.tipoConsumo as "LOCAL" | "LLEVAR"] += pedido.total;
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
    porProducto: ventasPorProducto(pedidos.flatMap((p) => p.items)).slice(0, 8),
  };
}

export async function generarExcelFinanciero(desde: Date, hasta: Date, agrupar: "dia" | "semana" | "mes"): Promise<ExcelJS.Buffer> {
  const reporte = await reporteFinanciero(desde, hasta, agrupar);
  const movimientos = await prisma.movimientoCaja.findMany({
    // Igual que en reporteFinanciero: sin los originales anulados ni sus
    // reversos, para que una venta cancelada no aparezca como egreso.
    where: { ...MOVIMIENTO_REAL_WHERE, creadoEn: { gte: desde, lte: hasta } },
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
  resumen.addRow(["Productos y extras más vendidos", "Cantidad", "Total"]);
  for (const p of reporte.porProducto) resumen.addRow([p.esExtra ? `${p.nombre} (extra)` : p.nombre, p.cantidad, p.total]);
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
