import type { Pedido as PedidoDTO, Configuracion, ItemAuditado, PedidoAuditoria as PedidoAuditoriaDTO } from "shared";
import type { CrearPedidoInput } from "shared";
import { totalLinea } from "shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { obtenerConfiguracion } from "../configuracion/service.js";
import { ajustarStockPorVenta } from "../insumos/service.js";
import { inicioDelDia, finDelDia } from "../reportes/service.js";
import { urlImagenPublica } from "../imagenes/urls.js";

/** Códigos de error transitorios de Prisma/SQLite bajo escritura concurrente
 * (varias estaciones cobrando/marcando "listo" al mismo tiempo) — no indican
 * un problema real del pedido, solo que la única conexión de escritura de
 * SQLite estaba ocupada. Reintentar unas pocas veces evita que el cajero o
 * la cocina vean un error 500 por esto (confirmado con una simulación de
 * 2000 pedidos concurrentes: sin reintento, ~1 de cada 2000 fallaba así). */
const CODIGOS_TRANSITORIOS = new Set(["P1008", "P2028"]);

function esErrorTransitorio(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && CODIGOS_TRANSITORIOS.has(error.code);
}

async function conReintento<T>(fn: () => Promise<T>, intentos = 3): Promise<T> {
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      return await fn();
    } catch (error) {
      if (intento === intentos || !esErrorTransitorio(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, intento * 150));
    }
  }
  throw new Error("inalcanzable");
}

/**
 * No todas las churrasquerías usan los mismos módulos (algunas solo cobran y
 * el mesero se encarga de todo; otras usan cocina+parrilla completas; etc. —
 * ver Configuración en el admin). Un módulo deshabilitado se trata como "ya
 * listo" (sus flags nacen en true). Si con eso cocina y parrilla ya están
 * listas y "entrega" sí está habilitada, el pedido nace COMPLETADO.
 *
 * Si "entrega" está deshabilitada, el pedido NO se cierra solo al cobrar: se
 * queda PAGADO (pendiente) para que todavía se pueda editar o anular — ej. el
 * cliente pide la devolución — y al cerrar caja todo lo pendiente del turno se
 * marca entregado (ver entregarPedidosDelTurno).
 */
function estadoEntregado() {
  const now = new Date();
  return {
    cocinaLista: true,
    parrillaLista: true,
    estado: "ENTREGADO" as const,
    completadoEn: now as Date | null,
    entregadoEn: now as Date | null,
  };
}

export function resolverEstadoInicial(config: Configuracion, requiereParrilla: boolean) {
  const cocinaLista = !config.cocinaHabilitada;
  const parrillaLista = !config.parrillaHabilitada || !requiereParrilla;

  const nadieMasLoMarca = cocinaLista && parrillaLista;
  if (nadieMasLoMarca && config.entregaHabilitada) {
    return {
      cocinaLista,
      parrillaLista,
      estado: "COMPLETADO" as const,
      completadoEn: new Date() as Date | null,
      entregadoEn: null as Date | null,
    };
  }

  return {
    cocinaLista,
    parrillaLista,
    estado: "PAGADO" as const,
    completadoEn: null as Date | null,
    entregadoEn: null as Date | null,
  };
}

const pedidoInclude = {
  // La foto del extra no se copia al pedido (ItemPedidoExtra): se toma del
  // extra, solo para armar su enlace (ver toPedidoDTO).
  items: { include: { extras: { include: { extra: { select: { imagenUrl: true } } } } } },
  cajero: true,
} as const;

type PedidoConRelaciones = Awaited<ReturnType<typeof prisma.pedido.findFirstOrThrow<{ include: typeof pedidoInclude }>>>;

export function toPedidoDTO(pedido: PedidoConRelaciones): PedidoDTO {
  return {
    id: String(pedido.id),
    folio: pedido.id,
    numeroTicket: pedido.numeroTicket,
    clienteId: pedido.clienteId,
    clienteNombre: pedido.clienteNombre,
    clienteCarnet: pedido.clienteCarnet,
    tipoConsumo: pedido.tipoConsumo as PedidoDTO["tipoConsumo"],
    mesa: pedido.mesa,
    total: pedido.total,
    estado: pedido.estado as PedidoDTO["estado"],
    metodoPago: pedido.metodoPago as PedidoDTO["metodoPago"],
    requiereParrilla: pedido.requiereParrilla,
    cocinaLista: pedido.cocinaLista,
    parrillaLista: pedido.parrillaLista,
    cajeroUsername: pedido.cajero.username,
    creadoEn: pedido.creadoEn.toISOString(),
    cocinaListaEn: pedido.cocinaListaEn ? pedido.cocinaListaEn.toISOString() : null,
    parrillaListaEn: pedido.parrillaListaEn ? pedido.parrillaListaEn.toISOString() : null,
    completadoEn: pedido.completadoEn ? pedido.completadoEn.toISOString() : null,
    entregadoEn: pedido.entregadoEn ? pedido.entregadoEn.toISOString() : null,
    items: pedido.items.map((item) => ({
      id: item.id,
      productoId: item.productoId,
      nombreProducto: item.nombreProducto,
      imagenUrl: urlImagenPublica("productos", item.productoId, item.imagenUrl),
      requiereParrilla: item.requiereParrilla,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      extras: item.extras.map((extra) => ({
        extraId: extra.extraId,
        nombre: extra.nombre,
        precio: extra.precio,
        cantidad: extra.cantidad,
        imagenUrl: urlImagenPublica("extras", extra.extraId, extra.extra.imagenUrl),
      })),
    })),
  };
}

/** "Congela" los ítems de un pedido para guardarlos en la auditoría — más
 * liviano que el DTO completo (sin ids), solo lo necesario para mostrar qué
 * cambió. */
function snapshotItems(pedido: PedidoConRelaciones): ItemAuditado[] {
  return pedido.items.map((item) => ({
    nombreProducto: item.nombreProducto,
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitario,
    extras: item.extras.map((e) => (e.cantidad > 1 ? `${e.cantidad}x ${e.nombre}` : e.nombre)),
  }));
}

async function registrarAuditoriaPedido(datos: {
  pedidoId: number;
  usuarioId: string;
  accion: "EDITADO" | "CANCELADO";
  antes: PedidoConRelaciones;
  despues: PedidoConRelaciones | null;
}) {
  await prisma.pedidoAuditoria.create({
    data: {
      pedidoId: datos.pedidoId,
      usuarioId: datos.usuarioId,
      accion: datos.accion,
      itemsAntes: JSON.stringify(snapshotItems(datos.antes)),
      itemsDespues: datos.despues ? JSON.stringify(snapshotItems(datos.despues)) : null,
      totalAntes: datos.antes.total,
      totalDespues: datos.despues?.total ?? null,
    },
  });
}

export async function listarAuditoriaPedido(pedidoId: number): Promise<PedidoAuditoriaDTO[]> {
  const registros = await prisma.pedidoAuditoria.findMany({
    where: { pedidoId },
    include: { usuario: true },
    orderBy: { creadoEn: "desc" },
  });
  return registros.map((r) => ({
    id: r.id,
    pedidoId: r.pedidoId,
    usuarioNombre: r.usuario.nombre,
    accion: r.accion as PedidoAuditoriaDTO["accion"],
    itemsAntes: JSON.parse(r.itemsAntes) as ItemAuditado[],
    itemsDespues: r.itemsDespues ? (JSON.parse(r.itemsDespues) as ItemAuditado[]) : null,
    totalAntes: r.totalAntes,
    totalDespues: r.totalDespues,
    creadoEn: r.creadoEn.toISOString(),
  }));
}

export class PedidoValidationError extends Error {}

/** Cobrar sin un turno abierto deja esa venta "flotando" fuera de cualquier
 * cierre de caja (el movimiento se registra con turnoId null y nunca entra
 * en el efectivoEsperado de ningún turno) — se pierde para la reconciliación
 * de esa plata. Por eso vender sin turno abierto queda bloqueado acá, no solo
 * sugerido en la UI.
 *
 * Si `turnoIdOriginal` viene (venta hecha offline y recién ahora
 * sincronizada), no exige que haya un turno abierto EN ESTE momento — la
 * venta ya ocurrió de verdad cuando ese turno todavía estaba abierto en el
 * equipo, así que solo confirma que ese turno exista y lo usa tal cual,
 * aunque ya se haya cerrado mientras tanto. */
async function resolverTurnoParaVenta(turnoIdOriginal?: string): Promise<{ id: string; cerrado: boolean }> {
  if (turnoIdOriginal) {
    const turno = await prisma.cajaTurno.findUnique({ where: { id: turnoIdOriginal } });
    if (!turno) {
      throw new PedidoValidationError("El turno de caja de esta venta (hecha sin conexión) ya no existe.");
    }
    return { id: turno.id, cerrado: turno.estado !== "ABIERTO" };
  }
  const turnoAbierto = await prisma.cajaTurno.findFirst({ where: { estado: "ABIERTO" } });
  if (!turnoAbierto) {
    throw new PedidoValidationError("No hay un turno de caja abierto — abrilo antes de cobrar.");
  }
  return { id: turnoAbierto.id, cerrado: false };
}

const CONFIG_POR_METODO_PAGO: Record<CrearPedidoInput["metodoPago"], keyof Configuracion> = {
  EFECTIVO: "pagoEfectivoHabilitado",
  TARJETA: "pagoTarjetaHabilitado",
  TRANSFERENCIA: "pagoTransferenciaHabilitado",
  QR: "pagoQrHabilitado",
};

/** El admin puede apagar un método de pago desde Configuración — validar acá
 * también (no solo ocultarlo en la UI) por si llega un pedido de una sesión
 * de Caja vieja que todavía tiene ese método visible. */
function asegurarMetodoPagoHabilitado(config: Configuracion, metodoPago: CrearPedidoInput["metodoPago"]) {
  if (!config[CONFIG_POR_METODO_PAGO[metodoPago]]) {
    throw new PedidoValidationError(`El método de pago "${metodoPago}" no está habilitado. Recargá la página de Caja.`);
  }
}

/** La mesa es obligatoria para consumo en local SOLO si el negocio la usa
 * (algunos restaurantes no manejan número de mesa) — ver Configuración. */
export function asegurarMesaValida(config: Configuracion, input: Pick<CrearPedidoInput, "tipoConsumo" | "mesa">) {
  if (input.tipoConsumo === "LOCAL" && config.mesaHabilitada && !input.mesa?.trim()) {
    throw new PedidoValidationError("La mesa es obligatoria para pedidos en local.");
  }
}

/** El nombre del cliente siempre es obligatorio (a diferencia de mesa/CI, no
 * depende de ninguna config) — se valida acá y no como .min(1) fijo en el
 * schema porque el nombre puede venir resuelto de un `clienteId` en vez de
 * como texto suelto (ver resolverCliente). */
export function asegurarNombreClienteValido(clienteNombre: string | null) {
  if (!clienteNombre?.trim()) {
    throw new PedidoValidationError("El nombre del cliente es obligatorio.");
  }
}

async function construirItems(items: CrearPedidoInput["items"]) {
  const productoIds = items.map((item) => item.productoId);
  const extraIds = [...new Set(items.flatMap((item) => item.extras.map((e) => e.extraId)))];

  const [productos, extras] = await Promise.all([
    prisma.producto.findMany({ where: { id: { in: productoIds }, activo: true } }),
    prisma.extra.findMany({ where: { id: { in: extraIds }, activo: true } }),
  ]);

  const productoMap = new Map(productos.map((p) => [p.id, p]));
  const extraMap = new Map(extras.map((e) => [e.id, e]));

  for (const item of items) {
    if (!productoMap.has(item.productoId)) {
      throw new PedidoValidationError(`Producto ${item.productoId} no existe o no está disponible`);
    }
    for (const seleccion of item.extras) {
      if (!extraMap.has(seleccion.extraId)) {
        throw new PedidoValidationError(`Extra ${seleccion.extraId} no existe o no está disponible`);
      }
    }
  }

  let total = 0;
  const itemsData = items.map((item) => {
    const producto = productoMap.get(item.productoId)!;
    const extrasData = item.extras.map((seleccion) => {
      const extra = extraMap.get(seleccion.extraId)!;
      return { extraId: extra.id, nombre: extra.nombre, precio: extra.precio, cantidad: seleccion.cantidad };
    });
    total += totalLinea(producto.precio, item.cantidad, extrasData);
    return {
      productoId: producto.id,
      nombreProducto: producto.nombre,
      imagenUrl: producto.imagenUrl,
      requiereParrilla: producto.requiereParrilla,
      cantidad: item.cantidad,
      precioUnitario: producto.precio,
      extras: { create: extrasData },
    };
  });

  const requiereParrilla = itemsData.some((item) => item.requiereParrilla);
  return { itemsData, total, requiereParrilla };
}

async function resolverCliente(input: Pick<CrearPedidoInput, "clienteId" | "clienteNombre" | "clienteCarnet">) {
  let clienteNombre = input.clienteNombre ?? null;
  let clienteCarnet = input.clienteCarnet ?? null;
  if (input.clienteId) {
    const cliente = await prisma.cliente.findUnique({ where: { id: input.clienteId } });
    if (!cliente) throw new PedidoValidationError(`Cliente ${input.clienteId} no existe`);
    // El snapshot prioriza el registro del cliente sobre texto suelto, para
    // mantener consistencia con lo que el cajero seleccionó.
    clienteNombre = cliente.nombre;
    clienteCarnet = cliente.carnet;
  }
  return { clienteNombre, clienteCarnet };
}

export interface ResultadoCrearPedido {
  pedido: PedidoDTO;
  /** false si esto era en realidad un reintento de sincronizar la misma
   * venta offline (mismo origenOfflineId) y ya se había insertado antes —
   * el caller no debe repetir el ingreso en el libro de caja ni los avisos
   * en vivo, o la venta quedaría contada dos veces. */
  esNueva: boolean;
  /** El turno al que quedó asociada la venta — lo necesita el caller para
   * registrar el ingreso de caja en ese mismo turno (ver registrarVentaPedido).
   * null cuando `esNueva` es false: ya se había registrado antes, así que el
   * caller no vuelve a tocar el libro de caja y no le hace falta. */
  turnoId: string | null;
}

export async function crearPedido(
  input: CrearPedidoInput,
  cajero: { id: string },
): Promise<ResultadoCrearPedido> {
  if (input.origenOfflineId) {
    const existente = await prisma.pedido.findUnique({
      where: { origenOfflineId: input.origenOfflineId },
      include: pedidoInclude,
    });
    if (existente) {
      return { pedido: toPedidoDTO(existente), esNueva: false, turnoId: null };
    }
  }

  const { id: turnoId, cerrado: turnoCerrado } = await resolverTurnoParaVenta(input.turnoIdOriginal);
  const { itemsData, total, requiereParrilla } = await construirItems(input.items);
  let { clienteNombre, clienteCarnet } = await resolverCliente(input);
  const config = await obtenerConfiguracion();
  asegurarMetodoPagoHabilitado(config, input.metodoPago);
  asegurarMesaValida(config, input);
  // Una venta offline pudo haberse cobrado y guardado en el equipo (encolada
  // para sincronizar) ANTES de que el nombre del cliente pasara a ser
  // obligatorio — esa plata ya se cobró de verdad, así que no tiene sentido
  // rechazar la sincronización y dejarla trabada. Solo para ese caso, se usa
  // un nombre genérico en vez de la venta normal (online), que si exige el
  // nombre real desde el formulario.
  if (input.origenOfflineId && !clienteNombre?.trim()) {
    clienteNombre = "Cliente (venta offline sin nombre)";
  }
  asegurarNombreClienteValido(clienteNombre);
  // Venta hecha sin conexión que llega cuando su turno ya se cerró: nadie va a
  // volver a cerrar ese turno, así que nace entregada en vez de quedar
  // pendiente para siempre.
  const estadoInicial = turnoCerrado ? estadoEntregado() : resolverEstadoInicial(config, requiereParrilla);
  const creadoEn = input.creadoEnOriginal ? new Date(input.creadoEnOriginal) : undefined;

  const pedido = await conReintento(() =>
    prisma.$transaction(async (tx) => {
      // increment es atómico en la base: dos cobros simultáneos en el mismo
      // turno nunca reciben el mismo número de ticket.
      const { ultimoTicket } = await tx.cajaTurno.update({
        where: { id: turnoId },
        data: { ultimoTicket: { increment: 1 } },
        select: { ultimoTicket: true },
      });
      const creado = await tx.pedido.create({
        data: {
          turnoId,
          numeroTicket: ultimoTicket,
          clienteId: input.clienteId ?? null,
          clienteNombre,
          clienteCarnet,
          tipoConsumo: input.tipoConsumo,
          mesa: input.tipoConsumo === "LOCAL" ? (input.mesa ?? null) : null,
          total,
          metodoPago: input.metodoPago,
          requiereParrilla,
          cajeroId: cajero.id,
          items: { create: itemsData },
          origenOfflineId: input.origenOfflineId ?? null,
          ...(creadoEn ? { creadoEn } : {}),
          ...estadoInicial,
        },
        include: pedidoInclude,
      });
      // Descuenta stock de insumos según la receta de cada producto vendido
      // (ver /admin/insumos) — atómico con la creación del pedido.
      await ajustarStockPorVenta(
        tx,
        itemsData.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
        -1,
      );
      return creado;
    }),
  );

  return { pedido: toPedidoDTO(pedido), esNueva: true, turnoId };
}

/** Un pedido solo se puede editar/cancelar mientras nadie en cocina o
 * parrilla empezó a prepararlo — evita confusión en planta sobre qué se
 * está preparando. */
/** Un módulo deshabilitado deja su flag en true desde que nace el pedido (ver
 * resolverEstadoInicial): eso no significa que alguien haya empezado nada, así
 * que solo cuenta el avance de los módulos que sí están habilitados. */
export function asegurarPedidoEditable(
  pedido: { estado: string; cocinaLista: boolean; parrillaLista: boolean; requiereParrilla: boolean },
  config: Pick<Configuracion, "cocinaHabilitada" | "parrillaHabilitada">,
) {
  if (pedido.estado !== "PAGADO") {
    throw new PedidoValidationError("Este pedido ya no está pendiente, no se puede modificar.");
  }
  const cocinaYaEmpezada = config.cocinaHabilitada && pedido.cocinaLista;
  const parrillaYaEmpezada = config.parrillaHabilitada && pedido.requiereParrilla && pedido.parrillaLista;
  if (cocinaYaEmpezada || parrillaYaEmpezada) {
    throw new PedidoValidationError(
      "Cocina o parrilla ya empezaron a preparar este pedido — cancelalo y creá uno nuevo si hace falta corregirlo.",
    );
  }
}

export async function editarPedido(id: number, input: CrearPedidoInput, usuarioId: string): Promise<PedidoDTO> {
  const actual = await prisma.pedido.findUnique({ where: { id }, include: pedidoInclude });
  if (!actual) throw new PedidoValidationError("Pedido no encontrado");
  const config = await obtenerConfiguracion();
  asegurarPedidoEditable(actual, config);

  const { itemsData, total, requiereParrilla } = await construirItems(input.items);
  const { clienteNombre, clienteCarnet } = await resolverCliente(input);
  asegurarMetodoPagoHabilitado(config, input.metodoPago);
  asegurarMesaValida(config, input);
  asegurarNombreClienteValido(clienteNombre);
  const estadoInicial = resolverEstadoInicial(config, requiereParrilla);

  const pedido = await conReintento(() =>
    prisma.$transaction(async (tx) => {
      await tx.itemPedido.deleteMany({ where: { pedidoId: id } });
      const actualizado = await tx.pedido.update({
        where: { id },
        data: {
          clienteId: input.clienteId ?? null,
          clienteNombre,
          clienteCarnet,
          tipoConsumo: input.tipoConsumo,
          mesa: input.tipoConsumo === "LOCAL" ? (input.mesa ?? null) : null,
          total,
          metodoPago: input.metodoPago,
          requiereParrilla,
          items: { create: itemsData },
          ...estadoInicial,
        },
        include: pedidoInclude,
      });
      // Repone el stock que habían consumido los ítems viejos y descuenta el
      // de los nuevos — neto equivalente a cancelar + crear de nuevo, pero
      // en un solo paso atómico.
      await ajustarStockPorVenta(
        tx,
        actual.items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
        1,
      );
      await ajustarStockPorVenta(
        tx,
        itemsData.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
        -1,
      );
      return actualizado;
    }),
  );

  await registrarAuditoriaPedido({ pedidoId: id, usuarioId, accion: "EDITADO", antes: actual, despues: pedido });
  return toPedidoDTO(pedido);
}

export async function cancelarPedido(id: number, usuarioId: string): Promise<PedidoDTO> {
  const actual = await prisma.pedido.findUnique({ where: { id }, include: pedidoInclude });
  if (!actual) throw new PedidoValidationError("Pedido no encontrado");
  asegurarPedidoEditable(actual, await obtenerConfiguracion());

  const pedido = await conReintento(() =>
    prisma.$transaction(async (tx) => {
      const cancelado = await tx.pedido.update({
        where: { id },
        data: { estado: "CANCELADO" },
        include: pedidoInclude,
      });
      // Repone el stock que estos ítems habían descontado al cobrarse.
      await ajustarStockPorVenta(
        tx,
        actual.items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
        1,
      );
      return cancelado;
    }),
  );

  await registrarAuditoriaPedido({ pedidoId: id, usuarioId, accion: "CANCELADO", antes: actual, despues: null });
  return toPedidoDTO(pedido);
}

const ESTADOS_SIN_ENTREGAR = ["PAGADO", "COMPLETADO"];

/** Pedidos cobrados en un turno que nadie marcó como entregados (cocina,
 * parrilla o entrega no se usan, o se olvidaron). Los anulados (CANCELADO)
 * quedan fuera por estado. */
export async function contarPedidosSinEntregarDelTurno(turnoId: string): Promise<number> {
  return prisma.pedido.count({ where: { turnoId, estado: { in: ESTADOS_SIN_ENTREGAR } } });
}

/** Al cerrar caja, todo lo cobrado en el turno que siga sin entregar se da por
 * entregado: cuando un local no usa las pantallas de cocina/parrilla/entrega,
 * nadie más va a marcarlos. Recibe el cliente de la transacción del cierre
 * para que cerrar el turno y entregar los pendientes sean todo-o-nada.
 * Devuelve los pedidos cerrados para avisar en vivo. */
export async function entregarPedidosDelTurno(turnoId: string, db: Prisma.TransactionClient): Promise<PedidoDTO[]> {
  const pendientes = await db.pedido.findMany({
    where: { turnoId, estado: { in: ESTADOS_SIN_ENTREGAR } },
    select: { id: true },
  });
  const ids = pendientes.map((p) => p.id);
  if (ids.length === 0) return [];

  const now = new Date();
  // Nunca pasaron por "listo": se completan y entregan a la vez.
  await db.pedido.updateMany({
    where: { id: { in: ids }, estado: "PAGADO" },
    data: { estado: "ENTREGADO", cocinaLista: true, parrillaLista: true, completadoEn: now, entregadoEn: now },
  });
  // Ya estaban listos (COMPLETADO): solo falta la entrega.
  await db.pedido.updateMany({
    where: { id: { in: ids }, estado: "COMPLETADO" },
    data: { estado: "ENTREGADO", entregadoEn: now },
  });

  // Solo los que realmente quedaron entregados (uno anulado justo en medio no).
  const cerrados = await db.pedido.findMany({
    where: { id: { in: ids }, estado: "ENTREGADO" },
    include: pedidoInclude,
  });
  return cerrados.map(toPedidoDTO);
}

export async function obtenerPedido(id: number): Promise<PedidoDTO | null> {
  const pedido = await prisma.pedido.findUnique({ where: { id }, include: pedidoInclude });
  return pedido ? toPedidoDTO(pedido) : null;
}

export async function listarCola(estacion: "cocina" | "parrilla" | "entrega"): Promise<PedidoDTO[]> {
  // Con el módulo apagado esa estación no se usa: no debe mostrar pedidos (que
  // siguen pendientes hasta cerrar caja) ni siquiera los que ya existían.
  const config = await obtenerConfiguracion();
  const habilitado =
    estacion === "cocina"
      ? config.cocinaHabilitada
      : estacion === "parrilla"
        ? config.parrillaHabilitada
        : config.entregaHabilitada;
  if (!habilitado) return [];

  const where: Prisma.PedidoWhereInput =
    estacion === "cocina"
      ? { estado: "PAGADO", cocinaLista: false }
      : estacion === "parrilla"
        ? { estado: "PAGADO", parrillaLista: false, requiereParrilla: true }
        : // "entrega" ve todo el pedido desde que se paga (para que el
          // encargado sepa qué viene, aunque cocina/parrilla todavía lo estén
          // preparando) hasta que queda listo — recién ahí se habilita el botón.
          { estado: { in: ["PAGADO", "COMPLETADO"] } };

  const pedidos = await prisma.pedido.findMany({
    where,
    include: pedidoInclude,
    orderBy: { id: "asc" },
  });

  return pedidos.map(toPedidoDTO);
}

export type FiltroPedidos = "pendientes" | "listos" | "atendidos" | "cancelados" | "todos";

export async function listarPedidos(
  filtro: FiltroPedidos,
  rango?: { desde: Date; hasta: Date },
): Promise<PedidoDTO[]> {
  const filtroEstado =
    filtro === "pendientes"
      ? { estado: "PAGADO" as const }
      : filtro === "listos"
        ? { estado: "COMPLETADO" as const }
        : filtro === "atendidos"
          ? { estado: "ENTREGADO" as const }
          : filtro === "cancelados"
            ? { estado: "CANCELADO" as const }
            : undefined;

  const where: Prisma.PedidoWhereInput = {
    ...filtroEstado,
    ...(rango ? { creadoEn: { gte: inicioDelDia(rango.desde), lte: finDelDia(rango.hasta) } } : {}),
  };

  const pedidos = await prisma.pedido.findMany({
    where,
    include: pedidoInclude,
    orderBy: { id: "desc" },
    // Sin filtro de fecha (uso interno, no la pantalla de Admin > Pedidos)
    // se limita a los últimos 100 como antes; con un rango de fechas, ese
    // rango ya acota la consulta y no hace falta cortarla arbitrariamente
    // (un día ocupado real puede pasar de 100 pedidos).
    take: rango ? undefined : 100,
  });

  return pedidos.map(toPedidoDTO);
}

interface MarcarListoResultado {
  pedido: PedidoDTO;
  completado: boolean;
  /** true si, además, se cerró de una vez a ENTREGADO porque el módulo
   * "entrega" está deshabilitado — la rama que terminó de preparar es la
   * última de la cadena, así que su "Listo" también cierra la entrega. */
  entregadoAuto: boolean;
}

async function marcarListo(pedidoId: number, rama: "cocina" | "parrilla"): Promise<MarcarListoResultado> {
  const actual = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!actual) throw new PedidoValidationError("Pedido no encontrado");
  if (actual.estado !== "PAGADO") {
    throw new PedidoValidationError("Este pedido ya no está pendiente (cancelado, completado o entregado).");
  }

  const now = new Date();
  const data =
    rama === "cocina"
      ? { cocinaLista: true, cocinaListaEn: now }
      : { parrillaLista: true, parrillaListaEn: now };

  let pedido = await conReintento(() =>
    prisma.pedido.update({
      where: { id: pedidoId },
      data,
      include: pedidoInclude,
    }),
  );

  const completado = pedido.cocinaLista && pedido.parrillaLista && pedido.estado === "PAGADO";
  let entregadoAuto = false;
  if (completado) {
    const config = await obtenerConfiguracion();
    entregadoAuto = !config.entregaHabilitada;
    pedido = await conReintento(() =>
      prisma.pedido.update({
        where: { id: pedidoId },
        data: entregadoAuto
          ? { estado: "ENTREGADO", completadoEn: now, entregadoEn: now }
          : { estado: "COMPLETADO", completadoEn: now },
        include: pedidoInclude,
      }),
    );
  }

  return { pedido: toPedidoDTO(pedido), completado, entregadoAuto };
}

export const marcarCocinaLista = (pedidoId: number) => marcarListo(pedidoId, "cocina");
export const marcarParrillaLista = (pedidoId: number) => marcarListo(pedidoId, "parrilla");

export async function marcarEntregado(pedidoId: number): Promise<PedidoDTO> {
  const actual = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!actual) throw new PedidoValidationError("Pedido no encontrado");
  if (actual.estado !== "COMPLETADO") {
    throw new PedidoValidationError("Este pedido todavía no está listo para entregar.");
  }

  const pedido = await conReintento(() =>
    prisma.pedido.update({
      where: { id: pedidoId },
      data: { estado: "ENTREGADO", entregadoEn: new Date() },
      include: pedidoInclude,
    }),
  );

  return toPedidoDTO(pedido);
}
