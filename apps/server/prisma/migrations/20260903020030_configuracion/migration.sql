-- CreateTable
CREATE TABLE "Configuracion" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "cocinaHabilitada" BOOLEAN NOT NULL DEFAULT true,
    "parrillaHabilitada" BOOLEAN NOT NULL DEFAULT true,
    "entregaHabilitada" BOOLEAN NOT NULL DEFAULT true
);
