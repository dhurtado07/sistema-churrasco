-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "orden" INTEGER NOT NULL DEFAULT 999;

-- Orden de los platos en el menú de Caja, pedido por el cliente: primero lo que
-- más se vende. Solo se asigna el orden de visualización; no se cambia ningún
-- nombre, precio ni otro dato. Los demás productos quedan en 999 (alfabético).
UPDATE "Producto" SET "orden" = CASE "nombre"
    WHEN 'Churrasco Sencillo' THEN 1
    WHEN 'Churrasco con Chorizo' THEN 2
    WHEN 'Pollo Ala' THEN 3
    WHEN 'Pollo Pierna' THEN 4
    WHEN 'Mixto' THEN 5
    WHEN 'Mixto Especial' THEN 6
    WHEN 'Vacío Bife' THEN 7
    WHEN 'Pollerita' THEN 8
  END
WHERE "categoria" = 'Platos'
  AND "nombre" IN ('Churrasco Sencillo', 'Churrasco con Chorizo', 'Pollo Ala', 'Pollo Pierna', 'Mixto', 'Mixto Especial', 'Vacío Bife', 'Pollerita');
