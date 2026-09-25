// Primero: env.js fija process.env.TZ antes de que cargue cualquier otro módulo.
import { env } from "./env.js";
import { buildApp } from "./app.js";
import { createSocketServer } from "./ws/socket.js";

async function main() {
  const app = await buildApp();
  await app.ready();

  createSocketServer(app.server);

  await app.listen({ port: env.port, host: "0.0.0.0" });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
