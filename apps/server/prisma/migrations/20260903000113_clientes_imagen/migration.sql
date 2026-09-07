-- AlterTable
ALTER TABLE "Producto" ADD COLUMN "imagenUrl" TEXT;

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "carnet" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pedido" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" TEXT,
    "clienteNombre" TEXT,
    "clienteCarnet" TEXT,
    "tipoConsumo" TEXT NOT NULL,
    "total" REAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PAGADO',
    "requiereParrilla" BOOLEAN NOT NULL,
    "cocinaLista" BOOLEAN NOT NULL DEFAULT false,
    "parrillaLista" BOOLEAN NOT NULL DEFAULT false,
    "cajeroId" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cocinaListaEn" DATETIME,
    "parrillaListaEn" DATETIME,
    "completadoEn" DATETIME,
    CONSTRAINT "Pedido_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Pedido_cajeroId_fkey" FOREIGN KEY ("cajeroId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Pedido" ("cajeroId", "clienteCarnet", "clienteNombre", "cocinaLista", "cocinaListaEn", "completadoEn", "creadoEn", "estado", "id", "parrillaLista", "parrillaListaEn", "requiereParrilla", "tipoConsumo", "total") SELECT "cajeroId", "clienteCarnet", "clienteNombre", "cocinaLista", "cocinaListaEn", "completadoEn", "creadoEn", "estado", "id", "parrillaLista", "parrillaListaEn", "requiereParrilla", "tipoConsumo", "total" FROM "Pedido";
DROP TABLE "Pedido";
ALTER TABLE "new_Pedido" RENAME TO "Pedido";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_carnet_key" ON "Cliente"("carnet");
