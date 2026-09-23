/** Código único y visible de un pedido (ej. COD142), armado con su folio
 * interno — que nunca se repite. El número de ticket reinicia en 1 en cada
 * turno, así que este es el que sirve para identificar un pedido con certeza. */
export function codigoPedido(folio: number): string {
  return `COD${folio}`;
}

/** Sirve para los buscadores: acepta "COD142", "cod142" o solo "142". */
export function coincideConCodigo(folio: number, termino: string): boolean {
  const buscado = termino.trim().toLowerCase();
  return codigoPedido(folio).toLowerCase().includes(buscado) || String(folio) === buscado;
}
