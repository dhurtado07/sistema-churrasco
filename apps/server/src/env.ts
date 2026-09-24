import "dotenv/config";

// Zona horaria del negocio (Bolivia). Los límites de "día" y la agrupación de los
// reportes se calculan en hora local: si el proceso corriera en UTC, las ventas
// de la noche caerían en el día siguiente. Docker ya la fija; esto cubre el resto
// (ej. desarrollo en Windows, donde `TZ=... comando` no funciona en los scripts).
process.env.TZ ??= "America/La_Paz";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

/** Un valor mal escrito (vacío, texto) no puede apagar ni bloquear el límite
 * de intentos de login: cae al default. */
function enteroPositivo(valor: string | undefined, porDefecto: number): number {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : porDefecto;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET"),
  // Uno o más orígenes separados por coma (ej. dominio con y sin "www").
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  // Credenciales para el basic-auth que protege /docs (Swagger UI) — sin
  // esto, el mapa completo de la API queda visible a cualquiera en internet.
  // Los defaults solo aplican si no se configuran (dev local); en
  // producción se sobreescriben con valores reales en .env.prod.
  // Intentos de login por minuto (anti fuerza bruta). En producción se deja el
  // default; en desarrollo se puede subir para correr la suite e2e completa,
  // que inicia sesión decenas de veces seguidas.
  loginRateLimitMax: enteroPositivo(process.env.LOGIN_RATE_LIMIT_MAX, 20),
  docsUser: process.env.DOCS_USER ?? "admin",
  docsPassword: process.env.DOCS_PASSWORD ?? "admin",
};
