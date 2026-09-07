import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import basicAuth from "@fastify/basic-auth";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "./env.js";
import { authPlugin } from "./auth/plugin.js";
import { authRoutes } from "./modules/auth/routes.js";
import { menuRoutes } from "./modules/menu/routes.js";
import { pedidosRoutes } from "./modules/pedidos/routes.js";
import { reportesRoutes } from "./modules/reportes/routes.js";
import { clientesRoutes } from "./modules/clientes/routes.js";
import { configuracionRoutes } from "./modules/configuracion/routes.js";
import { cajaRoutes } from "./modules/caja/routes.js";
import { proveedoresRoutes } from "./modules/proveedores/routes.js";
import { comprasRoutes } from "./modules/compras/routes.js";
import { inventarioRoutes } from "./modules/inventario/routes.js";
import { empleadosRoutes } from "./modules/empleados/routes.js";
import { asistenciaRoutes } from "./modules/asistencia/routes.js";
import { usuariosRoutes } from "./modules/usuarios/routes.js";
import { insumosRoutes } from "./modules/insumos/routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    // Los productos pueden traer una imagen como data URI en el body JSON —
    // el default de Fastify (1MB) se queda corto para eso.
    bodyLimit: 6 * 1024 * 1024,
    // Detrás de Caddy (y potencialmente Cloudflare delante de Caddy), la
    // conexión que ve Node siempre es la del proxy — sin esto, request.ip
    // sería siempre la misma IP interna para todo el mundo.
    trustProxy: true,
  });

  await app.register(cors, { origin: env.corsOrigin, credentials: true });
  // Headers de seguridad estándar (X-Content-Type-Options, X-Frame-Options,
  // Strict-Transport-Security, etc.). CSP desactivada: esta API solo
  // devuelve JSON salvo /docs (Swagger UI), que necesita cargar sus propios
  // scripts/estilos inline — una CSP estricta la rompería sin aportar nada
  // en un servidor que no sirve HTML de negocio.
  await app.register(helmet, { contentSecurityPolicy: false });
  // Límite generoso a nivel global: varias estaciones del mismo local pueden
  // compartir la misma IP pública, así que este número tiene que aguantar
  // tranquilo una hora pico real (~100 req/s) sin frenar el uso normal — es
  // solo para frenar un cliente totalmente descontrolado. El login tiene su
  // propio límite mucho más estricto por ruta (ver modules/auth/routes.ts)
  // para frenar fuerza bruta de contraseñas, que es el riesgo real acá.
  await app.register(rateLimit, {
    global: true,
    max: 6000,
    timeWindow: "1 minute",
    // Si el tráfico pasa por Cloudflare, Caddy siempre ve la IP del borde
    // de Cloudflare como origen de la conexión (no la del cliente real) —
    // "CF-Connecting-IP" es el header que Cloudflare agrega con la IP real,
    // así que hay que usarlo para que el límite aplique por cliente real y
    // no le pegue a todo el mundo por igual. Si no viene (sin Cloudflare
    // delante, ej. en dev), cae a la IP normal de la conexión.
    keyGenerator: (request) => (request.headers["cf-connecting-ip"] as string) || request.ip,
  });
  await app.register(authPlugin);

  // Documentación navegable de la API en /docs (ver ARCHITECTURE.md sección
  // 7 para el resumen manual que existía hasta ahora). Las rutas no declaran
  // JSON Schema por request/response (usan Zod + safeParse a mano), así que
  // acá se lista el mapa completo de endpoints con su método y con soporte
  // para probarlos a mano pegando un Bearer token — no hay validación de
  // payload documentada por-campo todavía, pero ya es muchísimo mejor que la
  // nada que había.
  // /docs expone el mapa completo de la API (rutas, roles, estructura) sin
  // necesitar login — sin esto, cualquiera en internet puede verlo. Va en un
  // scope aparte para que el basic-auth (protege con usuario/contraseña en
  // vez del JWT de la app, porque quien navega /docs a mano desde el
  // navegador no tiene un token a mano) solo afecte estas rutas y no el
  // resto de la API.
  await app.register(async (docsApp) => {
    await docsApp.register(basicAuth, {
      validate: async (username, password) => {
        if (username !== env.docsUser || password !== env.docsPassword) {
          throw new Error("Usuario o contraseña incorrectos");
        }
      },
      authenticate: { realm: "Documentación de la API" },
    });
    docsApp.addHook("onRequest", docsApp.basicAuth);

    await docsApp.register(swagger, {
      openapi: {
        info: {
          title: "API — Sistema Churrasquería (BRASA ARISP)",
          description:
            "Referencia de endpoints REST del servidor. Complementaria a ARCHITECTURE.md (que además documenta los eventos WebSocket, que esta vista no cubre). Para probar una ruta protegida, hacé login en POST /auth/login, copiá el token y usá 'Authorize' con 'Bearer <token>'.",
          version: "0.1.0",
        },
        components: {
          securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    });
    await docsApp.register(swaggerUi, { routePrefix: "/docs" });
  });

  app.get("/health", async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(menuRoutes);
  await app.register(pedidosRoutes);
  await app.register(reportesRoutes);
  await app.register(clientesRoutes);
  await app.register(configuracionRoutes);
  await app.register(cajaRoutes);
  await app.register(proveedoresRoutes);
  await app.register(comprasRoutes);
  await app.register(inventarioRoutes);
  await app.register(empleadosRoutes);
  await app.register(asistenciaRoutes);
  await app.register(usuariosRoutes);
  await app.register(insumosRoutes);

  return app;
}
