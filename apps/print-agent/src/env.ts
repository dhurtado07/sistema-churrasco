import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

export const env = {
  apiUrl: process.env.API_URL ?? "http://localhost:4000",
  username: required("PRINT_AGENT_USERNAME"),
  password: required("PRINT_AGENT_PASSWORD"),
  printerSink: (process.env.PRINTER_SINK ?? "file") as "file" | "tcp",
  printerHost: process.env.PRINTER_HOST ?? "",
  printerPort: Number(process.env.PRINTER_PORT ?? 9100),
  ticketsDir: process.env.TICKETS_DIR ?? "./tickets",
};
