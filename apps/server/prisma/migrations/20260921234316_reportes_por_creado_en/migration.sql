-- DropIndex
DROP INDEX "Pedido_completadoEn_idx";

-- CreateIndex
CREATE INDEX "Pedido_creadoEn_idx" ON "Pedido"("creadoEn");
