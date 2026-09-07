# Build en el contexto de la raíz del repo (necesita packages/shared) — ver
# docker-compose.prod.yml, que construye este Dockerfile con `context: .`.
# Instala el monorepo completo — ver la nota en apps/server/Dockerfile.

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile

FROM base AS build
# Vite incrusta esto en el bundle en tiempo de build — no es una variable de
# entorno de runtime, así que tiene que pasarse como build-arg.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter shared build && pnpm --filter web build

FROM caddy:2-alpine AS runtime
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv/web
