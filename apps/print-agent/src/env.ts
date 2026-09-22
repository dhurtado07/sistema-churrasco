import { config as cargarEnv } from "dotenv";
import { dirname, join } from "node:path";

// Cuando corre como .exe empaquetado (pkg), el archivo .env de configuración va
// JUNTO al ejecutable (no en el directorio desde donde se lanza). En desarrollo
// se usa el .env del directorio actual, como siempre.
const estaEmpaquetado = Boolean((process as unknown as { pkg?: unknown }).pkg);
const baseDir = estaEmpaquetado ? dirname(process.execPath) : process.cwd();
cargarEnv({ path: join(baseDir, ".env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

export const env = {
  apiUrl: process.env.API_URL ?? "http://localhost:4000",
  username: required("PRINT_AGENT_USERNAME"),
  password: required("PRINT_AGENT_PASSWORD"),
  printerSink: (process.env.PRINTER_SINK ?? "file") as "file" | "tcp" | "usb",
  printerHost: process.env.PRINTER_HOST ?? "",
  printerPort: Number(process.env.PRINTER_PORT ?? 9100),
  // Nombre de la impresora en el sistema (para PRINTER_SINK=usb). En macOS/Linux
  // es el nombre de la cola CUPS (ver `lpstat -p`); en Windows, el nombre con el
  // que se compartió la impresora (Compartir → nombre del recurso compartido).
  printerName: process.env.PRINTER_NAME ?? "",
  ticketsDir: process.env.TICKETS_DIR ?? "./tickets",
};
