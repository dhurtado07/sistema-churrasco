import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import net from "node:net";
import type { Pedido } from "shared";
import { env } from "./env.js";
import { construirTicketEscPos, construirTicketTexto, NEGOCIO_POR_DEFECTO, type NegocioInfo } from "./ticket.js";

async function imprimirEnArchivo(pedido: Pedido, negocio: NegocioInfo): Promise<void> {
  await mkdir(env.ticketsDir, { recursive: true });
  const base = join(env.ticketsDir, `ticket-${String(pedido.folio).padStart(5, "0")}`);
  await writeFile(`${base}.txt`, construirTicketTexto(pedido, negocio), "utf-8");
  await writeFile(`${base}.escpos.bin`, construirTicketEscPos(pedido, negocio));
  console.log(`[print-agent] (modo prueba) ticket #${pedido.folio} escrito en ${base}.txt`);
}

function imprimirPorTcp(pedido: Pedido, negocio: NegocioInfo): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!env.printerHost) {
      reject(new Error("PRINTER_HOST no configurado (requerido para PRINTER_SINK=tcp)"));
      return;
    }
    const socket = net.createConnection({ host: env.printerHost, port: env.printerPort }, () => {
      socket.write(construirTicketEscPos(pedido, negocio), (err) => {
        if (err) return reject(err);
        socket.end();
      });
    });
    socket.setTimeout(5000, () => {
      socket.destroy(new Error("Timeout conectando a la impresora"));
    });
    socket.on("close", () => resolve());
    socket.on("error", reject);
  });
}

export async function imprimirTicket(pedido: Pedido, negocio: NegocioInfo = NEGOCIO_POR_DEFECTO): Promise<void> {
  if (env.printerSink === "tcp") {
    await imprimirPorTcp(pedido, negocio);
    console.log(`[print-agent] ticket #${pedido.folio} enviado a la impresora (${env.printerHost}:${env.printerPort})`);
  } else {
    await imprimirEnArchivo(pedido, negocio);
  }
}
