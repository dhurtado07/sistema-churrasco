import type { CrearPedidoInput } from "shared";

const CLAVE = "churrasco.pedidosOffline";

export interface VentaOfflineEncolada {
  /** = origenOfflineId que se manda al servidor al sincronizar — hace que
   * reintentar sea seguro (ver Pedido.origenOfflineId en el schema). */
  id: string;
  creadoEn: string;
  /** Para mostrarla en pantalla sin tener que recalcularla — el body que se
   * manda al servidor solo tiene ids de producto/extra, no precios. */
  total: number;
  body: CrearPedidoInput;
  /** Si la última sincronización falló por un error real del servidor (no
   * por falta de red), queda acá para que la cajera sepa que esa venta
   * necesita que un admin la revise — nunca se borra sola. */
  errorSincronizacion: string | null;
}

function leer(): VentaOfflineEncolada[] {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as VentaOfflineEncolada[]) : [];
  } catch {
    return [];
  }
}

function guardar(lista: VentaOfflineEncolada[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    // localStorage lleno o bloqueado (modo privado) — no hay dónde más
    // guardarlo; la venta ya se le mostró a la cajera igual, así que no se
    // pierde el cobro, solo el reintento automático si esto pasa.
  }
}

export function leerColaOffline(): VentaOfflineEncolada[] {
  return leer();
}

export function encolarVentaOffline(body: CrearPedidoInput, turnoId: string, total: number): VentaOfflineEncolada {
  const entrada: VentaOfflineEncolada = {
    id: crypto.randomUUID(),
    creadoEn: new Date().toISOString(),
    total,
    body: { ...body, origenOfflineId: undefined, turnoIdOriginal: turnoId },
    errorSincronizacion: null,
  };
  // El origenOfflineId se completa recién acá para que sea el mismo id que
  // identifica esta entrada en la cola local — así, si el navegador se
  // cierra a mitad de sincronizar, reintentar más tarde con ese mismo id no
  // duplica la venta del lado del servidor.
  entrada.body.origenOfflineId = entrada.id;
  entrada.body.creadoEnOriginal = entrada.creadoEn;

  const lista = leer();
  lista.push(entrada);
  guardar(lista);
  return entrada;
}

export function quitarDeColaOffline(id: string) {
  guardar(leer().filter((v) => v.id !== id));
}

export function marcarErrorEnColaOffline(id: string, mensaje: string) {
  guardar(leer().map((v) => (v.id === id ? { ...v, errorSincronizacion: mensaje } : v)));
}
