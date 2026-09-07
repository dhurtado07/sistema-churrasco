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

## Puesta en marcha (desarrollo)

```bash
pnpm install

# Backend: variables de entorno y base de datos (SQLite local, sin config extra)
cp apps/server/.env.example apps/server/.env
pnpm db:migrate    # crea apps/server/prisma/dev.db
pnpm db:seed       # usuarios de prueba + menú inicial

# Frontend: variables de entorno
cp apps/web/.env.example apps/web/.env

# Levantar server + web en paralelo
pnpm dev
```

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

## Antes de desplegar a producción

1. **Base de datos**: cambiar `provider` a `postgresql` en
   `apps/server/prisma/schema.prisma` y `DATABASE_URL` a la connection string
   de Neon/Supabase/Railway (ver `.env.example`), luego correr
   `pnpm db:migrate` de nuevo contra esa base. El schema ya está escrito de
   forma portable (sin enums nativos de SQLite), así que el cambio es
   puramente de configuración, sin tocar modelos.
2. Cambiar `JWT_SECRET` por un secreto real (server y, si aplica, el que use
   el agente de impresión para loguearse).
3. Configurar `CORS_ORIGIN` (server) y `VITE_API_URL` (web) con los dominios
   reales de despliegue.
4. **Impresión de tickets**: instalar `apps/print-agent` en la PC de caja,
   apuntando `API_URL` al backend desplegado y `PRINTER_SINK=tcp` con la IP
   de la impresora térmica. Ver sección 8 de `ARCHITECTURE.md`.
