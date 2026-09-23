/**
 * Simula la impresión de un ticket SIN mandar nada a la impresora — para probar
 * el formato (ancho, columnas, corte) sin gastar papel. Genera el ticket como
 * texto legible y como bytes ESC/POS, los guarda en ./tickets y muestra el texto
 * en consola. Uso: `pnpm --filter print-agent simular`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pedido } from "shared";
import { construirTicketEscPos, construirTicketTexto, NEGOCIO_POR_DEFECTO } from "./ticket.js";

// Pedido de ejemplo con varios ítems y extras (el caso más "cargado").
const pedido = {
  folio: 128,
  numeroTicket: 7,
  creadoEn: new Date().toISOString(),
  clienteNombre: "Juan Perez",
  clienteCarnet: null,
  tipoConsumo: "LOCAL",
  mesa: 4,
  total: 215,
  cajeroUsername: "caja1",
  items: [
    { cantidad: 2, nombreProducto: "Churrasco especial", precioUnitario: 65, extras: [{ nombre: "Huevo frito", cantidad: 2, precio: 5 }] },
    { cantidad: 1, nombreProducto: "Pollo a la brasa", precioUnitario: 45, extras: [] },
    { cantidad: 3, nombreProducto: "Refresco", precioUnitario: 10, extras: [] },
  ],
} as unknown as Pedido;

const negocio = { ...NEGOCIO_POR_DEFECTO, nombreNegocio: "BRASA ARISP", direccion: "Av. Siempre Viva 123", telefono: "700-12345" };

const texto = construirTicketTexto(pedido, negocio);
const bin = construirTicketEscPos(pedido, negocio);

const dir = "./tickets";
await mkdir(dir, { recursive: true });
await writeFile(join(dir, "simulacion.txt"), texto, "utf-8");
await writeFile(join(dir, "simulacion.escpos.bin"), bin);

const anchoMax = Math.max(...texto.split("\n").map((l) => l.length));
const tieneCorte = bin.includes(Buffer.from([0x1d, 0x56])); // GS V — comando de corte

console.log("\n┌─ Vista previa del ticket (así saldría impreso) ─┐\n");
console.log(texto);
console.log("└" + "─".repeat(49) + "┘\n");
console.log(`Ancho máx de línea: ${anchoMax} caracteres`);
console.log(`Bytes ESC/POS: ${bin.length}`);
console.log(`Comando de corte automático presente: ${tieneCorte ? "sí ✅" : "NO ❌"}`);
console.log(`\nArchivos: ${join(dir, "simulacion.txt")} y ${join(dir, "simulacion.escpos.bin")}`);
console.log("(No se imprimió nada — es solo simulación.)\n");
