-- CreateIndex
CREATE INDEX "Asistencia_empleadoId_momento_idx" ON "Asistencia"("empleadoId", "momento");

-- CreateIndex
CREATE INDEX "CajaTurno_estado_idx" ON "CajaTurno"("estado");

-- CreateIndex
CREATE INDEX "Compra_proveedorId_idx" ON "Compra"("proveedorId");

-- CreateIndex
CREATE INDEX "Compra_fecha_idx" ON "Compra"("fecha");

-- CreateIndex
CREATE INDEX "CompraItem_compraId_idx" ON "CompraItem"("compraId");

-- CreateIndex
CREATE INDEX "CompraItem_insumoId_idx" ON "CompraItem"("insumoId");

-- CreateIndex
CREATE INDEX "ItemPedido_pedidoId_idx" ON "ItemPedido"("pedidoId");

-- CreateIndex
CREATE INDEX "ItemPedido_productoId_idx" ON "ItemPedido"("productoId");

-- CreateIndex
CREATE INDEX "ItemPedidoExtra_itemPedidoId_idx" ON "ItemPedidoExtra"("itemPedidoId");

-- CreateIndex
CREATE INDEX "ItemPedidoExtra_extraId_idx" ON "ItemPedidoExtra"("extraId");

-- CreateIndex
CREATE INDEX "MovimientoCaja_turnoId_idx" ON "MovimientoCaja"("turnoId");

-- CreateIndex
CREATE INDEX "MovimientoCaja_creadoEn_idx" ON "MovimientoCaja"("creadoEn");

-- CreateIndex
CREATE INDEX "MovimientoCaja_pedidoId_idx" ON "MovimientoCaja"("pedidoId");

-- CreateIndex
CREATE INDEX "Pedido_estado_idx" ON "Pedido"("estado");

-- CreateIndex
CREATE INDEX "Pedido_completadoEn_idx" ON "Pedido"("completadoEn");

-- CreateIndex
CREATE INDEX "PedidoAuditoria_pedidoId_idx" ON "PedidoAuditoria"("pedidoId");
