-- AlterTable
ALTER TABLE "CajaTurno" ADD COLUMN     "ultimoTicket" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "numeroTicket" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "turnoId" TEXT;

-- CreateIndex
CREATE INDEX "Pedido_turnoId_idx" ON "Pedido"("turnoId");

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "CajaTurno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Datos existentes: el turno de cada pedido sale de su ingreso de venta en el
-- libro de caja; el número de ticket pasa a ser su posición dentro del turno.
-- Los pedidos sin turno conocido conservan su folio como número de ticket.
UPDATE "Pedido" p
SET "turnoId" = v."turnoId"
FROM (
  SELECT DISTINCT ON ("pedidoId") "pedidoId", "turnoId"
  FROM "MovimientoCaja"
  WHERE "pedidoId" IS NOT NULL AND "turnoId" IS NOT NULL AND "categoria" = 'VENTA' AND "tipo" = 'INGRESO'
  ORDER BY "pedidoId", "creadoEn" ASC
) v
WHERE v."pedidoId" = p."id";

UPDATE "Pedido" p
SET "numeroTicket" = n."posicion"
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "turnoId" ORDER BY "id") AS "posicion"
  FROM "Pedido"
  WHERE "turnoId" IS NOT NULL
) n
WHERE n."id" = p."id";

UPDATE "Pedido" SET "numeroTicket" = "id" WHERE "turnoId" IS NULL;

UPDATE "CajaTurno" t
SET "ultimoTicket" = COALESCE((SELECT MAX("numeroTicket") FROM "Pedido" WHERE "turnoId" = t."id"), 0);
