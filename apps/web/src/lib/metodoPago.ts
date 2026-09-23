import type { MetodoPago } from "shared";

/** Único lugar con el nombre visible de cada medio de pago. */
export const METODO_LABEL: Record<MetodoPago, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  QR: "QR",
};
