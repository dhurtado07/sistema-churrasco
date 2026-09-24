/** Redondea a centavos: sumar decimales en coma flotante deja ruido (0.1 + 0.2
 * = 0.30000000000000004) que un cierre exacto vería como "sobran Bs 0,00". */
export function aCentavos(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Total de UNA línea de pedido: el plato por su cantidad, más sus extras.
 *
 * Cada extra tiene su propia cantidad (las porciones que se piden en esa línea)
 * y se cobra UNA vez, tal cual se muestra en pantalla y en el ticket — NO se
 * multiplica además por la cantidad del plato. Multiplicarlo cobraba de más:
 * "2 platos + 1 arroz" mostraba 1 arroz pero cobraba 2. Es el único lugar
 * donde se define esta fórmula (servidor, reportes y pantallas la usan). */
export function totalLinea(
  precioUnitario: number,
  cantidad: number,
  extras: { precio: number; cantidad: number }[],
): number {
  const extrasTotal = extras.reduce((suma, extra) => suma + extra.precio * extra.cantidad, 0);
  return aCentavos(precioUnitario * cantidad + extrasTotal);
}
