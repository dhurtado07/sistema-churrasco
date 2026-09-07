import type { Pedido } from "shared";
import { EscPosBuilder } from "./escpos.js";

const ANCHO = 32; // caracteres por línea — típico de rollo térmico de 58mm

export interface NegocioInfo {
  nombreNegocio: string;
  direccion: string | null;
  telefono: string | null;
}

export const NEGOCIO_POR_DEFECTO: NegocioInfo = { nombreNegocio: "BRASA ARISP", direccion: null, telefono: null };

function formatoMoneda(valor: number): string {
  return `Bs ${valor.toFixed(2)}`;
}

function lineaDosColumnas(izquierda: string, derecha: string, ancho = ANCHO): string {
  // Siempre deja al menos 1 espacio entre columnas y nunca excede `ancho`,
  // incluso cuando el texto de la izquierda llena justo el ancho disponible.
  const maxIzquierda = Math.max(0, ancho - derecha.length - 1);
  const izquierdaAjustada = izquierda.length > maxIzquierda ? izquierda.slice(0, maxIzquierda) : izquierda;
  const espacios = Math.max(1, ancho - izquierdaAjustada.length - derecha.length);
  return izquierdaAjustada + " ".repeat(espacios) + derecha;
}

function fechaHoraLocal(iso: string): string {
  return new Date(iso).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" });
}

function tipoConsumoTexto(pedido: Pedido): string {
  return pedido.tipoConsumo === "LOCAL" ? `Mesa ${pedido.mesa ?? "?"}` : "Para llevar";
}

/** Construye el buffer de bytes ESC/POS listo para enviar a la impresora térmica. */
export function construirTicketEscPos(pedido: Pedido, negocio: NegocioInfo = NEGOCIO_POR_DEFECTO): Buffer {
  const builder = new EscPosBuilder().init().align("center").bold(true).doubleSize(true);
  builder.line(negocio.nombreNegocio);
  builder.doubleSize(false).bold(false);
  if (negocio.direccion) builder.line(negocio.direccion);
  if (negocio.telefono) builder.line(`Tel: ${negocio.telefono}`);
  builder.line(`Ticket #${pedido.folio}`);
  builder.line(fechaHoraLocal(pedido.creadoEn));
  builder.align("left");
  builder.separator();

  if (pedido.clienteNombre) builder.line(`Cliente: ${pedido.clienteNombre}`);
  if (pedido.clienteCarnet) builder.line(`Carnet: ${pedido.clienteCarnet}`);
  builder.line(tipoConsumoTexto(pedido));
  builder.separator();

  for (const item of pedido.items) {
    builder.line(lineaDosColumnas(`${item.cantidad}x ${item.nombreProducto}`, formatoMoneda(item.precioUnitario * item.cantidad)));
    for (const extra of item.extras) {
      builder.line(lineaDosColumnas(`  + ${extra.nombre}`, formatoMoneda(extra.precio)));
    }
  }

  builder.separator();
  builder.bold(true);
  builder.line(lineaDosColumnas("TOTAL", formatoMoneda(pedido.total)));
  builder.bold(false);
  builder.separator();
  builder.align("center");
  builder.line(`Atendido por: ${pedido.cajeroUsername}`);
  builder.feed(3);
  builder.cut();

  return builder.toBuffer();
}

/** Versión legible en texto plano — usada por el sink "file" (modo de prueba sin impresora). */
export function construirTicketTexto(pedido: Pedido, negocio: NegocioInfo = NEGOCIO_POR_DEFECTO): string {
  const lineas: string[] = [];
  lineas.push(negocio.nombreNegocio);
  if (negocio.direccion) lineas.push(negocio.direccion);
  if (negocio.telefono) lineas.push(`Tel: ${negocio.telefono}`);
  lineas.push(`Ticket #${pedido.folio}`);
  lineas.push(fechaHoraLocal(pedido.creadoEn));
  lineas.push("-".repeat(ANCHO));
  if (pedido.clienteNombre) lineas.push(`Cliente: ${pedido.clienteNombre}`);
  if (pedido.clienteCarnet) lineas.push(`Carnet: ${pedido.clienteCarnet}`);
  lineas.push(tipoConsumoTexto(pedido));
  lineas.push("-".repeat(ANCHO));
  for (const item of pedido.items) {
    lineas.push(lineaDosColumnas(`${item.cantidad}x ${item.nombreProducto}`, formatoMoneda(item.precioUnitario * item.cantidad)));
    for (const extra of item.extras) {
      lineas.push(lineaDosColumnas(`  + ${extra.nombre}`, formatoMoneda(extra.precio)));
    }
  }
  lineas.push("-".repeat(ANCHO));
  lineas.push(lineaDosColumnas("TOTAL", formatoMoneda(pedido.total)));
  lineas.push("-".repeat(ANCHO));
  lineas.push(`Atendido por: ${pedido.cajeroUsername}`);
  return lineas.join("\n") + "\n";
}
