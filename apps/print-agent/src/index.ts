import { io } from "socket.io-client";
import { SOCKET_EVENTS, type Configuracion, type Pedido } from "shared";
import { env } from "./env.js";
import { imprimirTicket } from "./printerSink.js";
import { NEGOCIO_POR_DEFECTO, type NegocioInfo } from "./ticket.js";

async function login(): Promise<string> {
  const res = await fetch(`${env.apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: env.username, password: env.password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`No se pudo autenticar el agente de impresión: ${body.error ?? res.status}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

async function obtenerNegocio(token: string): Promise<NegocioInfo> {
  try {
    const res = await fetch(`${env.apiUrl}/configuracion`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return NEGOCIO_POR_DEFECTO;
    const config = (await res.json()) as Configuracion;
    return { nombreNegocio: config.nombreNegocio, direccion: config.direccion, telefono: config.telefono };
  } catch {
    return NEGOCIO_POR_DEFECTO;
  }
}

async function imprimirConReintento(pedido: Pedido, negocio: NegocioInfo, intentos = 3): Promise<void> {
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      await imprimirTicket(pedido, negocio);
      return;
    } catch (error) {
      console.error(`[print-agent] intento ${intento}/${intentos} falló para ticket #${pedido.folio}:`, (error as Error).message);
      if (intento === intentos) {
        console.error(
          `[print-agent] ticket #${pedido.folio} NO se pudo imprimir. El ticket digital sigue disponible en caja para reintentar o reimprimir.`,
        );
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000 * intento));
      }
    }
  }
}

async function main() {
  console.log(`[print-agent] conectando a ${env.apiUrl} (sink: ${env.printerSink})`);
  const token = await login();
  let negocio = await obtenerNegocio(token);

  const socket = io(env.apiUrl, { auth: { token } });

  socket.on(SOCKET_EVENTS.CONFIGURACION_ACTUALIZADA, (config: Configuracion) => {
    negocio = { nombreNegocio: config.nombreNegocio, direccion: config.direccion, telefono: config.telefono };
  });

  socket.on("connect", () => {
    console.log("[print-agent] conectado, esperando tickets…");
  });

  socket.on("disconnect", (reason) => {
    console.warn(`[print-agent] desconectado (${reason}), reintentando…`);
  });

  socket.on("connect_error", (err) => {
    console.error("[print-agent] error de conexión:", err.message);
  });

  socket.on(SOCKET_EVENTS.TICKET_IMPRIMIR, (pedido: Pedido) => {
    console.log(`[print-agent] ticket #${pedido.folio} recibido`);
    void imprimirConReintento(pedido, negocio);
  });
}

main().catch((error) => {
  console.error("[print-agent] error fatal:", error);
  process.exit(1);
});
