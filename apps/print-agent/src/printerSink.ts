import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
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

/**
 * Impresora térmica conectada por USB: mandamos los bytes ESC/POS crudos a la
 * cola de impresión del sistema operativo. Es la forma estándar y confiable de
 * imprimir tickets (la que usan los POS que "funcionan bien"): la impresora
 * avanza solo lo que ocupa el ticket y corta — sin el desperdicio de papel que
 * genera imprimir desde el navegador.
 *
 * - macOS/Linux: `lp -d <cola> -o raw` (CUPS), los bytes van por stdin.
 * - Windows: no existe "lp -o raw"; se copian los bytes crudos a la impresora
 *   compartida con `copy /b`. Por eso en Windows PRINTER_NAME es el nombre del
 *   recurso compartido, no el de la cola.
 */
async function imprimirPorUsb(pedido: Pedido, negocio: NegocioInfo): Promise<void> {
  if (!env.printerName) {
    throw new Error("PRINTER_NAME no configurado (requerido para PRINTER_SINK=usb)");
  }
  const datos = construirTicketEscPos(pedido, negocio);

  if (process.platform === "win32") {
    const tmp = join(tmpdir(), `ticket-${String(pedido.folio).padStart(5, "0")}.bin`);
    await writeFile(tmp, datos);
    await ejecutar("cmd", ["/c", "copy", "/b", tmp, `\\\\localhost\\${env.printerName}`]);
    return;
  }

  await ejecutar("lp", ["-d", env.printerName, "-o", "raw"], datos);
}

/** Corre un comando externo, opcionalmente escribiéndole `entrada` por stdin. */
function ejecutar(comando: string, args: string[], entrada?: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(comando, args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject); // p.ej. el comando no existe
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${comando} terminó con código ${code}${stderr ? `: ${stderr.trim()}` : ""}`));
    });
    if (entrada) {
      proc.stdin.write(entrada);
      proc.stdin.end();
    }
  });
}

export async function imprimirTicket(pedido: Pedido, negocio: NegocioInfo = NEGOCIO_POR_DEFECTO): Promise<void> {
  if (env.printerSink === "tcp") {
    await imprimirPorTcp(pedido, negocio);
    console.log(`[print-agent] ticket #${pedido.folio} enviado a la impresora (${env.printerHost}:${env.printerPort})`);
  } else if (env.printerSink === "usb") {
    await imprimirPorUsb(pedido, negocio);
    console.log(`[print-agent] ticket #${pedido.folio} enviado a la impresora USB (${env.printerName})`);
  } else {
    await imprimirEnArchivo(pedido, negocio);
  }
}
