import { buildApp } from "./app.js";
import { createSocketServer } from "./ws/socket.js";
import { env } from "./env.js";

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
