-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "mesaHabilitada" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pagoEfectivoHabilitado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pagoQrHabilitado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pagoTarjetaHabilitado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pagoTransferenciaHabilitado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "qrPagoUrl" TEXT;
