-- CreateTable
CREATE TABLE "CajaTurno" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "abiertoPorId" TEXT NOT NULL,
    "fondoInicial" REAL NOT NULL,
    "abiertoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "cerradoPorId" TEXT,
    "efectivoContado" REAL,
    "efectivoEsperado" REAL,
    "diferencia" REAL,
    "notaCierre" TEXT,
    "cerradoEn" DATETIME,
    CONSTRAINT "CajaTurno_abiertoPorId_fkey" FOREIGN KEY ("abiertoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CajaTurno_cerradoPorId_fkey" FOREIGN KEY ("cerradoPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MovimientoCaja" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "turnoId" TEXT,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "metodoPago" TEXT,
    "pedidoId" INTEGER,
    "compraId" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "anulaMovimientoId" TEXT,
    "anulado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimientoCaja_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "CajaTurno" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovimientoCaja_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovimientoCaja_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovimientoCaja_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimientoCaja_anulaMovimientoId_fkey" FOREIGN KEY ("anulaMovimientoId") REFERENCES "MovimientoCaja" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "contacto" TEXT,
    "telefono" TEXT,
    "categoria" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Compra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proveedorId" TEXT,
    "proveedorNombre" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" REAL NOT NULL,
    "notas" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Compra_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompraItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "compraId" TEXT NOT NULL,
    "insumo" TEXT NOT NULL,
    "categoria" TEXT,
    "cantidad" REAL NOT NULL,
    "unidad" TEXT NOT NULL,
    "precioUnitario" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "CompraItem_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivoInventario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "estado" TEXT NOT NULL DEFAULT 'BUENO',
    "valorUnitario" REAL,
    "fechaAdquisicion" DATETIME,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Empleado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "puesto" TEXT NOT NULL,
    "sueldo" REAL NOT NULL,
    "fechaContratacion" DATETIME,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Empleado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asistencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empleadoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "momento" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origen" TEXT NOT NULL DEFAULT 'KIOSKO',
    "notas" TEXT,
    CONSTRAINT "Asistencia_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Configuracion" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "cocinaHabilitada" BOOLEAN NOT NULL DEFAULT true,
    "parrillaHabilitada" BOOLEAN NOT NULL DEFAULT true,
    "entregaHabilitada" BOOLEAN NOT NULL DEFAULT true,
    "nombreNegocio" TEXT NOT NULL DEFAULT 'BRASA ARISP',
    "direccion" TEXT,
    "telefono" TEXT,
    "nit" TEXT,
    "logoUrl" TEXT
);
INSERT INTO "new_Configuracion" ("cocinaHabilitada", "entregaHabilitada", "id", "parrillaHabilitada") SELECT "cocinaHabilitada", "entregaHabilitada", "id", "parrillaHabilitada" FROM "Configuracion";
DROP TABLE "Configuracion";
ALTER TABLE "new_Configuracion" RENAME TO "Configuracion";
CREATE TABLE "new_Pedido" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" TEXT,
    "clienteNombre" TEXT,
    "clienteCarnet" TEXT,
    "tipoConsumo" TEXT NOT NULL,
    "mesa" TEXT,
    "total" REAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PAGADO',
    "metodoPago" TEXT NOT NULL DEFAULT 'EFECTIVO',
    "requiereParrilla" BOOLEAN NOT NULL,
    "cocinaLista" BOOLEAN NOT NULL DEFAULT false,
    "parrillaLista" BOOLEAN NOT NULL DEFAULT false,
    "cajeroId" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cocinaListaEn" DATETIME,
    "parrillaListaEn" DATETIME,
    "completadoEn" DATETIME,
    "entregadoEn" DATETIME,
    CONSTRAINT "Pedido_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Pedido_cajeroId_fkey" FOREIGN KEY ("cajeroId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Pedido" ("cajeroId", "clienteCarnet", "clienteId", "clienteNombre", "cocinaLista", "cocinaListaEn", "completadoEn", "creadoEn", "entregadoEn", "estado", "id", "mesa", "parrillaLista", "parrillaListaEn", "requiereParrilla", "tipoConsumo", "total") SELECT "cajeroId", "clienteCarnet", "clienteId", "clienteNombre", "cocinaLista", "cocinaListaEn", "completadoEn", "creadoEn", "entregadoEn", "estado", "id", "mesa", "parrillaLista", "parrillaListaEn", "requiereParrilla", "tipoConsumo", "total" FROM "Pedido";
DROP TABLE "Pedido";
ALTER TABLE "new_Pedido" RENAME TO "Pedido";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MovimientoCaja_anulaMovimientoId_key" ON "MovimientoCaja"("anulaMovimientoId");

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_usuarioId_key" ON "Empleado"("usuarioId");
