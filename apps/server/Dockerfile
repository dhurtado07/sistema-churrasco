# Build en el contexto de la raíz del repo (necesita packages/shared) — ver
# docker-compose.prod.yml, que construye este Dockerfile con `context: .`.
#
# node:20-slim (Debian), no node:20-alpine: el motor de Prisma se compila
# contra glibc/openssl y en Alpine (musl + openssl 3.x sin el paquete
# openssl1.1-compat) falla en runtime con un error de parseo del schema
# engine — confirmado probando el build local antes de este cambio.
#
# Instala el monorepo completo (no solo lo que necesita "server") — un
# intento anterior con `pnpm install --filter server...` rompía la
# resolución del paquete `prisma` de forma no obvia; instalar todo es más
# simple y confiable, y el proyecto es chico así que el costo extra de
# tamaño/tiempo no importa.

FROM node:20-slim AS base
# node:20-slim tampoco trae OpenSSL por defecto — Prisma lo necesita para
# detectar qué motor usar (si no, cae en un default que no siempre matchea
# y falla en runtime al conectar a la base).
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile

FROM base AS build
# El cliente de Prisma se genera ANTES del build — tsc necesita esos tipos
# generados para compilar (todo lo que toca datos de Prisma se vuelve "any"
# y explota en un montón de errores si el orden se invierte).
RUN pnpm --filter server run db:generate
RUN pnpm --filter shared build && pnpm --filter server build

FROM node:20-slim AS runtime
# tzdata: el server calcula los límites de "día" (inicioDelDia/finDelDia) y
# formatea fechas en hora LOCAL. Sin fijar la zona, el contenedor corre en UTC
# y un pedido hecho de noche en Bolivia (UTC-4) cae en el día UTC siguiente:
# desaparecía de Admin > Pedidos y descuadraba los reportes por día. Fijamos la
# zona del negocio (Bolivia, sin horario de verano) para que todo el cálculo de
# días use esa hora.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl tzdata && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo
COPY --from=build /repo ./
ENV NODE_ENV=production
ENV TZ=America/La_Paz
WORKDIR /repo/apps/server
EXPOSE 4000
# Aplica migraciones pendientes contra Postgres y recién ahí arranca — así
# un deploy nunca sirve tráfico contra un schema desactualizado.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/index.js"]
