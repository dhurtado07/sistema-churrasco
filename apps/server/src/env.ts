import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
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
  docsUser: process.env.DOCS_USER ?? "admin",
  docsPassword: process.env.DOCS_PASSWORD ?? "admin",
};
