import type { Pedido as PedidoDTO, Configuracion, ItemAuditado, PedidoAuditoria as PedidoAuditoriaDTO } from "shared";
import type { CrearPedidoInput } from "shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { obtenerConfiguracion } from "../configuracion/service.js";
import { ajustarStockPorVenta } from "../insumos/service.js";

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
 * listo" automáticamente, y si con eso el pedido ya está listo por ambas
 * ramas, se cierra en cascada hasta donde los módulos habilitados alcancen:
 * PAGADO -> COMPLETADO (si cocina+parrilla ok) -> ENTREGADO (si además
 * "entrega" está deshabilitada, nadie va a confirmarlo a mano).
 */
function resolverEstadoInicial(config: Configuracion, requiereParrilla: boolean) {
  const now = new Date();
  const cocinaLista = !config.cocinaHabilitada;
  const parrillaLista = !config.parrillaHabilitada || !requiereParrilla;

  if (!(cocinaLista && parrillaLista)) {
    return {
      cocinaLista,
      parrillaLista,
      estado: "PAGADO" as const,
      completadoEn: null as Date | null,
      entregadoEn: null as Date | null,
    };
  }

  const entregado = !config.entregaHabilitada;
  return {
    cocinaLista,
    parrillaLista,
    estado: (entregado ? "ENTREGADO" : "COMPLETADO") as "ENTREGADO" | "COMPLETADO",
    completadoEn: now,
    entregadoEn: entregado ? now : null,
  };
}

const pedidoInclude = {
  items: { include: { extras: true } },
  cajero: true,
} as const;

type PedidoConRelaciones = Awaited<ReturnType<typeof prisma.pedido.findFirstOrThrow<{ include: typeof pedidoInclude }>>>;

export function toPedidoDTO(pedido: PedidoConRelaciones): PedidoDTO {
  return {
    id: String(pedido.id),
    folio: pedido.id,
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
      imagenUrl: item.imagenUrl,
      requiereParrilla: item.requiereParrilla,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      extras: item.extras.map((extra) => ({
        extraId: extra.extraId,
        nombre: extra.nombre,
        precio: extra.precio,
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
    extras: item.extras.map((e) => e.nombre),
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
function asegurarMesaValida(config: Configuracion, input: Pick<CrearPedidoInput, "tipoConsumo" | "mesa">) {
  if (input.tipoConsumo === "LOCAL" && config.mesaHabilitada && !input.mesa?.trim()) {
    throw new PedidoValidationError("La mesa es obligatoria para pedidos en local.");
  }
}

async function construirItems(items: CrearPedidoInput["items"]) {
  const productoIds = items.map((item) => item.productoId);
  const extraIds = [...new Set(items.flatMap((item) => item.extraIds))];

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
    for (const extraId of item.extraIds) {
      if (!extraMap.has(extraId)) {
        throw new PedidoValidationError(`Extra ${extraId} no existe o no está disponible`);
      }
    }
  }

  let total = 0;
  const itemsData = items.map((item) => {
    const producto = productoMap.get(item.productoId)!;
    const extrasData = item.extraIds.map((extraId) => {
      const extra = extraMap.get(extraId)!;
      total += extra.precio * item.cantidad;
      return { extraId: extra.id, nombre: extra.nombre, precio: extra.precio };
    });
    total += producto.precio * item.cantidad;
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

export async function crearPedido(
  input: CrearPedidoInput,
  cajero: { id: string },
): Promise<PedidoDTO> {
  const { itemsData, total, requiereParrilla } = await construirItems(input.items);
  const { clienteNombre, clienteCarnet } = await resolverCliente(input);
  const config = await obtenerConfiguracion();
  asegurarMetodoPagoHabilitado(config, input.metodoPago);
  asegurarMesaValida(config, input);
  const estadoInicial = resolverEstadoInicial(config, requiereParrilla);

  const pedido = await conReintento(() =>
    prisma.$transaction(async (tx) => {
      const creado = await tx.pedido.create({
        data: {
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

  return toPedidoDTO(pedido);
}

/** Un pedido solo se puede editar/cancelar mientras nadie en cocina o
 * parrilla empezó a prepararlo — evita confusión en planta sobre qué se
 * está preparando. */
function asegurarPedidoEditable(pedido: { estado: string; cocinaLista: boolean; parrillaLista: boolean; requiereParrilla: boolean }) {
  if (pedido.estado !== "PAGADO") {
    throw new PedidoValidationError("Este pedido ya no está pendiente, no se puede modificar.");
  }
  const parrillaYaEmpezada = pedido.requiereParrilla && pedido.parrillaLista;
  if (pedido.cocinaLista || parrillaYaEmpezada) {
    throw new PedidoValidationError(
      "Cocina o parrilla ya empezaron a preparar este pedido — cancelalo y creá uno nuevo si hace falta corregirlo.",
    );
  }
}

export async function editarPedido(id: number, input: CrearPedidoInput, usuarioId: string): Promise<PedidoDTO> {
  const actual = await prisma.pedido.findUnique({ where: { id }, include: pedidoInclude });
  if (!actual) throw new PedidoValidationError("Pedido no encontrado");
  asegurarPedidoEditable(actual);

  const { itemsData, total, requiereParrilla } = await construirItems(input.items);
  const { clienteNombre, clienteCarnet } = await resolverCliente(input);
  const config = await obtenerConfiguracion();
  asegurarMetodoPagoHabilitado(config, input.metodoPago);
  asegurarMesaValida(config, input);
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
  asegurarPedidoEditable(actual);

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

export async function obtenerPedido(id: number): Promise<PedidoDTO | null> {
  const pedido = await prisma.pedido.findUnique({ where: { id }, include: pedidoInclude });
  return pedido ? toPedidoDTO(pedido) : null;
}

export async function listarCola(estacion: "cocina" | "parrilla" | "entrega"): Promise<PedidoDTO[]> {
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

export async function listarPedidos(filtro: FiltroPedidos): Promise<PedidoDTO[]> {
  const where =
    filtro === "pendientes"
      ? { estado: "PAGADO" as const }
      : filtro === "listos"
        ? { estado: "COMPLETADO" as const }
        : filtro === "atendidos"
          ? { estado: "ENTREGADO" as const }
          : filtro === "cancelados"
            ? { estado: "CANCELADO" as const }
            : undefined;

  const pedidos = await prisma.pedido.findMany({
    where,
    include: pedidoInclude,
    orderBy: { id: "desc" },
    take: 100,
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
