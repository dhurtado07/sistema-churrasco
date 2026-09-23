-- El libro de caja decía "Venta pedido #<código interno>", pero las pantallas
-- muestran el número de ticket del turno (que reinicia en 1 cada turno). Se
-- alinea el texto de los movimientos existentes; el vínculo real con el pedido
-- sigue siendo "pedidoId", que no cambia.
UPDATE "MovimientoCaja" m
SET "concepto" = CASE
    WHEN m."concepto" LIKE 'Reverso: Venta pedido #%' THEN 'Reverso: Venta ticket #' || p."numeroTicket"
    ELSE 'Venta ticket #' || p."numeroTicket"
  END
FROM "Pedido" p
WHERE m."pedidoId" = p."id"
  AND m."categoria" = 'VENTA'
  AND (m."concepto" LIKE 'Venta pedido #%' OR m."concepto" LIKE 'Reverso: Venta pedido #%');
