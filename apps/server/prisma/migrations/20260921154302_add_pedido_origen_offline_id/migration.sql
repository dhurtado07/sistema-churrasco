-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "origenOfflineId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_origenOfflineId_key" ON "Pedido"("origenOfflineId");
