# sistema-churrasco — BRASA ARISP

Sistema web para la atención de una churrasquería: caja (POS), cocina y
parrilla sincronizadas en tiempo real, impresión de tickets térmicos,
control de caja/dinero, compras e inventario, empleados con asistencia,
reportes financieros con gráficos, y un menú público en `/menu`.

Ver [`ARCHITECTURE.md`](./ARCHITECTURE.md) para el diseño técnico original
(flujo del pedido, modelo de datos, stack, despliegue) y
[`FUNCIONALIDADES.md`](./FUNCIONALIDADES.md) para el detalle funcional
completo (qué tiene y qué falta).

## Estructura

```
apps/server/       API + WebSocket (Fastify + Socket.IO + Prisma)
apps/web/          Frontend (React + Vite + Tailwind) — rutas /caja /cocina /parrilla /admin
apps/print-agent/  Agente de impresión térmica ESC/POS (corre en la PC de caja)
packages/shared/   Tipos y schemas Zod compartidos entre server, web y print-agent
```

## Requisitos

- Node.js 20+
- pnpm (`corepack enable` si no lo tienes, o `npm i -g pnpm`)
- Docker (o Podman) — para la base de datos Postgres en desarrollo

## Puesta en marcha (desarrollo)

```bash
pnpm install

# Base de datos: Postgres en un contenedor (ver docker-compose.yml)
pnpm db:up

# Backend: variables de entorno
cp apps/server/.env.example apps/server/.env
pnpm db:migrate    # crea las tablas en Postgres
pnpm db:seed       # usuarios de prueba + menú inicial

# Frontend: variables de entorno
cp apps/web/.env.example apps/web/.env

# Levantar server + web en paralelo
pnpm dev
```

Nota (Windows + Podman en vez de Docker Desktop): si `localhost` da error de
autenticación en `pnpm db:migrate` pese a tener la contraseña correcta, es un
problema de reenvío de puertos de la VM de Podman — usar la IP de la VM
(`podman machine ssh "ip addr show eth0"`) en `DATABASE_URL` en vez de
`localhost`. Con Docker Desktop esto no pasa.

- API: http://localhost:4000
- Web: http://localhost:5173

### Agente de impresión (opcional en desarrollo)

Corre aparte porque en producción va instalado en la PC de caja, no junto al
servidor. Por defecto usa modo de prueba (`PRINTER_SINK=file`): escribe cada
ticket en `apps/print-agent/tickets/` en vez de mandarlo a una impresora real,
así se puede probar el flujo completo sin tener el hardware todavía.

```bash
cp apps/print-agent/.env.example apps/print-agent/.env
pnpm dev:print-agent
```

Cuando haya una impresora térmica de verdad conectada por red/LAN, cambiar en
`apps/print-agent/.env`:

```bash
PRINTER_SINK="tcp"
PRINTER_HOST="192.168.1.50"   # IP de la impresora
PRINTER_PORT=9100             # puerto RAW/JetDirect estándar de ESC/POS
```

## Usuarios de prueba (creados por el seed)

| Usuario | Contraseña | Rol | Ruta / uso |
|---|---|---|---|
| `cajero` | `cajero123` | cajero | `/caja` |
| `cocina` | `cocina123` | cocina | `/cocina` |
| `parrilla` | `parrilla123` | parrilla | `/parrilla` |
| `entrega` | `entrega123` | entrega | `/entrega` |
| `admin` | `admin123` | admin | `/admin` |
| `impresora` | `impresora123` | impresora | usado por `apps/print-agent`, no tiene pantalla propia |
| `parrillero1` | `empleado123` | empleado | `/asistencia` (marcar entrada/salida) |

Cambiar estas contraseñas antes de usar en producción.

## Despliegue a producción (automático)

El sitio se despliega solo a un VPS cada vez que se mergea a `main`, vía
GitHub Actions (`.github/workflows/deploy.yml`): copia el código al servidor
por SSH y levanta `docker-compose.prod.yml` (Postgres + servidor + Caddy con
HTTPS automático). Ver ese archivo para el detalle del pipeline.

### Puesta en marcha del VPS (una sola vez)

1. **Instalar Docker** en el VPS (Ubuntu):
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
2. **Crear la carpeta de despliegue** y copiar ahí `docker-compose.prod.yml`,
   `apps/server/Dockerfile`, `apps/web/Dockerfile` y `apps/web/Caddyfile`
   (o simplemente dejar que el primer deploy de GitHub Actions los copie).
3. **Crear `.env.prod`** en esa carpeta con valores reales — ver
   `.env.prod.example` para la lista completa (`POSTGRES_PASSWORD`,
   `JWT_SECRET`, `CORS_ORIGIN`, `VITE_API_URL`). Este archivo **no** se sube a
   git ni lo toca el pipeline — vive solo en el servidor.
4. **DNS**: apuntar el dominio (registro `A`) y `api.<dominio>` a la IP del
   VPS. Caddy saca el certificado HTTPS solo en cuanto el DNS resuelva.
5. **Llave SSH de despliegue**: generar un par de llaves dedicado (no la
   personal), agregar la pública a `~/.ssh/authorized_keys` del VPS, y cargar
   la privada como secreto de GitHub (`gh secret set DEPLOY_SSH_KEY < clave_privada`).
   Además cargar `DEPLOY_HOST` (IP o dominio del VPS), `DEPLOY_USER` (usuario
   SSH) y `DEPLOY_PATH` (carpeta de despliegue, ej. `/opt/sistema-churrasco`).

Con eso, cada PR mergeado a `main` reconstruye y reinicia los contenedores
solo — sin pasos manuales.

### Impresión de tickets

Instalar `apps/print-agent` en la PC de caja (no en el VPS), apuntando
`API_URL` al backend desplegado (`https://api.<dominio>`) y
`PRINTER_SINK=tcp` con la IP de la impresora térmica. Ver sección 8 de
`ARCHITECTURE.md`.
