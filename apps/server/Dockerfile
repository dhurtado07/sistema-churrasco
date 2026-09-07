# Build en el contexto de la raíz del repo (necesita packages/shared) — ver
# docker-compose.prod.yml, que construye este Dockerfile con `context: .`.

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

# Copiar solo los manifiestos primero (para cachear la instalación de
# dependencias mientras no cambien package.json/lockfile, aunque cambie el
# código fuente).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/server/package.json apps/server/package.json
RUN pnpm install --frozen-lockfile --filter server...

FROM base AS build
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN pnpm --filter shared build && pnpm --filter server build
RUN pnpm --filter server exec prisma generate

FROM node:20-alpine AS runtime
RUN corepack enable
WORKDIR /repo
COPY --from=build /repo ./
ENV NODE_ENV=production
WORKDIR /repo/apps/server
EXPOSE 4000
# Aplica migraciones pendientes contra Postgres y recién ahí arranca — así
# un deploy nunca sirve tráfico contra un schema desactualizado.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/index.js"]
