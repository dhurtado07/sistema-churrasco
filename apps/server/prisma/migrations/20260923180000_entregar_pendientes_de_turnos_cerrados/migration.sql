-- Datos existentes: los locales que solo usan Caja nunca marcaron sus pedidos
-- como entregados, así que quedaron pendientes para siempre. Desde ahora eso
-- se hace solo al cerrar caja (ver entregarPedidosDelTurno); esto hace lo
-- mismo con lo que ya quedó pendiente en turnos cerrados. Los anulados
-- (CANCELADO) no se tocan. Se usa la hora de cierre del turno como fecha de
-- entrega para no inventar una hora nueva.
UPDATE "Pedido" p
SET "estado" = 'ENTREGADO',
    "cocinaLista" = true,
    "parrillaLista" = true,
    "completadoEn" = COALESCE(p."completadoEn", t."cerradoEn"),
    "entregadoEn" = t."cerradoEn"
FROM "CajaTurno" t
WHERE p."turnoId" = t."id"
  AND t."estado" = 'CERRADO'
  AND t."cerradoEn" IS NOT NULL
  AND p."estado" IN ('PAGADO', 'COMPLETADO');
