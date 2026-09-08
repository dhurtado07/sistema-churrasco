import { z } from "zod";

export const tipoConsumoSchema = z.enum(["LOCAL", "LLEVAR"]);

export const metodoPagoSchema = z.enum(["EFECTIVO", "TARJETA", "TRANSFERENCIA", "QR"]);

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const cambiarMiPasswordSchema = z.object({
  passwordActual: z.string().min(1),
  passwordNueva: z.string().min(6),
});

// ---------------------------------------------------------------------------
// Cuentas de estación (cajero, cocina, parrilla, entrega, admin, impresora) —
// una cuenta por estación/kiosko, distinta de las cuentas de empleado (que se
// gestionan en /admin/empleados y solo sirven para marcar asistencia).
// ---------------------------------------------------------------------------

export const rolEstacionSchema = z.enum(["cajero", "cocina", "parrilla", "entrega", "admin", "impresora"]);

// Rol de estación que puede tener un Empleado (persona individual) — puede
// no tener ninguno ("empleado" = solo marca asistencia, sin acceso a ninguna
// pantalla de trabajo), o el de una estación puntual. Nunca admin/impresora
// desde este flujo — esos son roles técnicos/de estación compartida, no algo
// que se le asigne a una persona vía "Empleados".
export const rolEmpleadoSchema = z.enum(["empleado", "cajero", "cocina", "parrilla", "entrega"]);

export const crearUsuarioEstacionSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  nombre: z.string().min(1),
  rol: rolEstacionSchema,
});

export const actualizarUsuarioEstacionSchema = z.object({
  nombre: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  activo: z.boolean().optional(),
});

// Imagen ya redimensionada/comprimida en el navegador antes de subirla (ver
// resizeImageToDataUrl en apps/web) — el límite es generoso pero evita que un
// payload gigante llegue a la API o a la base de datos.
export const IMAGEN_MAX_CHARS = 2_000_000;

const imagenUrlSchema = z
  .string()
  .max(IMAGEN_MAX_CHARS)
  .refine((v) => v.startsWith("data:image/") || v.startsWith("http"), {
    message: "imagenUrl debe ser una data URI de imagen o una URL http(s)",
  });

export const crearProductoSchema = z.object({
  nombre: z.string().min(1),
  categoria: z.string().min(1),
  precio: z.number().positive(),
  requiereParrilla: z.boolean(),
  imagenUrl: imagenUrlSchema.nullable().optional(),
});

export const actualizarProductoSchema = crearProductoSchema.partial().extend({
  activo: z.boolean().optional(),
});

export const crearExtraSchema = z.object({
  nombre: z.string().min(1),
  precio: z.number().nonnegative(),
  imagenUrl: imagenUrlSchema.nullable().optional(),
});

export const actualizarExtraSchema = crearExtraSchema.partial().extend({
  activo: z.boolean().optional(),
});

export const crearClienteSchema = z.object({
  nombre: z.string().min(1),
  carnet: z.string().min(1).optional(),
});

export const itemPedidoInputSchema = z.object({
  productoId: z.string().min(1),
  cantidad: z.number().int().positive(),
  extraIds: z.array(z.string()).default([]),
});

// La mesa es obligatoria para consumo en local SOLO si el negocio la usa
// (Configuración > mesaHabilitada — algunos restaurantes no manejan mesas).
// Como esa validación depende de la config guardada en la base, no se puede
// resolver acá con un simple .refine() estático — se hace en
// pedidos/service.ts#asegurarMesaValida, con la config ya cargada.
export const crearPedidoSchema = z.object({
  clienteId: z.string().min(1).optional(),
  clienteNombre: z.string().min(1).optional(),
  clienteCarnet: z.string().min(1).optional(),
  tipoConsumo: tipoConsumoSchema,
  mesa: z.string().min(1).optional(),
  metodoPago: metodoPagoSchema.default("EFECTIVO"),
  items: z.array(itemPedidoInputSchema).min(1),
});

export const actualizarConfiguracionSchema = z.object({
  cocinaHabilitada: z.boolean().optional(),
  parrillaHabilitada: z.boolean().optional(),
  entregaHabilitada: z.boolean().optional(),
  mesaHabilitada: z.boolean().optional(),
  nombreNegocio: z.string().min(1).optional(),
  direccion: z.string().min(1).nullable().optional(),
  telefono: z.string().min(1).nullable().optional(),
  nit: z.string().min(1).nullable().optional(),
  logoUrl: imagenUrlSchema.nullable().optional(),
  pagoEfectivoHabilitado: z.boolean().optional(),
  pagoTarjetaHabilitado: z.boolean().optional(),
  pagoTransferenciaHabilitado: z.boolean().optional(),
  pagoQrHabilitado: z.boolean().optional(),
  qrPagoUrl: imagenUrlSchema.nullable().optional(),
});

// ---------------------------------------------------------------------------
// Caja y dinero
// ---------------------------------------------------------------------------

export const abrirTurnoSchema = z.object({
  fondoInicial: z.number().nonnegative(),
});

export const cerrarTurnoSchema = z.object({
  efectivoContado: z.number().nonnegative(),
  notaCierre: z.string().min(1).optional(),
});

export const categoriaMovimientoCajaSchema = z.enum([
  "VENTA",
  "COMPRA_INSUMO",
  "PAGO_PROVEEDOR",
  "SUELDO",
  "SERVICIO",
  "OTRO",
]);

export const crearMovimientoCajaSchema = z.object({
  tipo: z.enum(["INGRESO", "EGRESO"]),
  categoria: categoriaMovimientoCajaSchema,
  concepto: z.string().min(1),
  monto: z.number().positive(),
  metodoPago: metodoPagoSchema.optional(),
});

// ---------------------------------------------------------------------------
// Compras, proveedores e inventario
// ---------------------------------------------------------------------------

export const crearProveedorSchema = z.object({
  nombre: z.string().min(1),
  contacto: z.string().min(1).optional(),
  telefono: z.string().min(1).optional(),
  categoria: z.string().min(1).optional(),
});

export const actualizarProveedorSchema = crearProveedorSchema.partial().extend({
  activo: z.boolean().optional(),
});

export const compraItemInputSchema = z.object({
  insumo: z.string().min(1),
  categoria: z.string().min(1).optional(),
  cantidad: z.number().positive(),
  unidad: z.string().min(1),
  precioUnitario: z.number().nonnegative(),
  // Si se linkea a un insumo del catálogo, la compra repone su stock
  // automáticamente al registrarse.
  insumoId: z.string().min(1).optional(),
});

export const crearCompraSchema = z.object({
  proveedorId: z.string().min(1).optional(),
  proveedorNombre: z.string().min(1).optional(),
  notas: z.string().min(1).optional(),
  items: z.array(compraItemInputSchema).min(1),
});

// ---------------------------------------------------------------------------
// Insumos (stock) y recetas
// ---------------------------------------------------------------------------

export const unidadInsumoSchema = z.enum(["kg", "litro", "unidad", "paquete"]);

export const crearInsumoSchema = z.object({
  nombre: z.string().min(1),
  categoria: z.string().min(1).optional(),
  unidad: unidadInsumoSchema,
  stockInicial: z.number().nonnegative().default(0),
  stockMinimo: z.number().nonnegative().default(0),
});

export const actualizarInsumoSchema = z.object({
  nombre: z.string().min(1).optional(),
  categoria: z.string().min(1).nullable().optional(),
  unidad: unidadInsumoSchema.optional(),
  stockMinimo: z.number().nonnegative().optional(),
  activo: z.boolean().optional(),
});

export const ajustarStockInsumoSchema = z.object({
  // Delta: positivo suma stock (ej. conteo físico encontró más), negativo
  // resta (merma, producto vencido, etc.).
  delta: z.number().refine((v) => v !== 0, "El ajuste no puede ser cero"),
  nota: z.string().min(1),
});

export const recetaItemInputSchema = z.object({
  insumoId: z.string().min(1),
  cantidadPorUnidad: z.number().positive(),
});

export const actualizarRecetaSchema = z.object({
  items: z.array(recetaItemInputSchema),
});

export const crearActivoInventarioSchema = z.object({
  nombre: z.string().min(1),
  categoria: z.string().min(1).optional(),
  cantidad: z.number().int().positive().default(1),
  estado: z.enum(["BUENO", "REGULAR", "MALO", "BAJA"]).default("BUENO"),
  valorUnitario: z.number().nonnegative().optional(),
  fechaAdquisicion: z.string().datetime().optional(),
  notas: z.string().min(1).optional(),
});

export const actualizarActivoInventarioSchema = crearActivoInventarioSchema.partial().extend({
  activo: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Empleados y asistencia
// ---------------------------------------------------------------------------

// PIN corto (no una contraseña) para confirmar identidad al marcar
// asistencia — pensado para tipear rápido en un kiosko compartido.
export const pinSchema = z.string().regex(/^\d{4,6}$/, "El PIN debe ser numérico, de 4 a 6 dígitos");

export const crearEmpleadoSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  nombre: z.string().min(1),
  puesto: z.string().min(1),
  sueldo: z.number().nonnegative(),
  fechaContratacion: z.string().datetime().optional(),
  telefono: z.string().min(1).optional(),
  pin: pinSchema.optional(),
  // Sin rol asignado ("empleado", el default): solo puede marcar asistencia
  // y ver sus propias horas. Con un rol de estación, además accede a esa
  // pantalla de trabajo (como cualquier cuenta de esa estación).
  rol: rolEmpleadoSchema.default("empleado"),
});

export const actualizarEmpleadoSchema = z.object({
  nombre: z.string().min(1).optional(),
  puesto: z.string().min(1).optional(),
  sueldo: z.number().nonnegative().optional(),
  telefono: z.string().min(1).nullable().optional(),
  activo: z.boolean().optional(),
  password: z.string().min(6).optional(),
  pin: pinSchema.optional(),
  rol: rolEmpleadoSchema.optional(),
});

export const marcarAsistenciaSchema = z.object({
  notas: z.string().min(1).optional(),
  pin: z.string().optional(),
});

export type CrearPedidoInput = z.infer<typeof crearPedidoSchema>;
export type ActualizarConfiguracionInput = z.infer<typeof actualizarConfiguracionSchema>;
export type CrearProductoInput = z.infer<typeof crearProductoSchema>;
export type ActualizarProductoInput = z.infer<typeof actualizarProductoSchema>;
export type CrearExtraInput = z.infer<typeof crearExtraSchema>;
export type ActualizarExtraInput = z.infer<typeof actualizarExtraSchema>;
export type CrearClienteInput = z.infer<typeof crearClienteSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AbrirTurnoInput = z.infer<typeof abrirTurnoSchema>;
export type CerrarTurnoInput = z.infer<typeof cerrarTurnoSchema>;
export type CrearMovimientoCajaInput = z.infer<typeof crearMovimientoCajaSchema>;
export type CrearProveedorInput = z.infer<typeof crearProveedorSchema>;
export type ActualizarProveedorInput = z.infer<typeof actualizarProveedorSchema>;
export type CrearCompraInput = z.infer<typeof crearCompraSchema>;
export type CrearActivoInventarioInput = z.infer<typeof crearActivoInventarioSchema>;
export type ActualizarActivoInventarioInput = z.infer<typeof actualizarActivoInventarioSchema>;
export type CrearEmpleadoInput = z.infer<typeof crearEmpleadoSchema>;
export type ActualizarEmpleadoInput = z.infer<typeof actualizarEmpleadoSchema>;
export type MarcarAsistenciaInput = z.infer<typeof marcarAsistenciaSchema>;
export type CambiarMiPasswordInput = z.infer<typeof cambiarMiPasswordSchema>;
export type RolEstacion = z.infer<typeof rolEstacionSchema>;
export type RolEmpleado = z.infer<typeof rolEmpleadoSchema>;
export type CrearUsuarioEstacionInput = z.infer<typeof crearUsuarioEstacionSchema>;
export type ActualizarUsuarioEstacionInput = z.infer<typeof actualizarUsuarioEstacionSchema>;
export type UnidadInsumo = z.infer<typeof unidadInsumoSchema>;
export type CrearInsumoInput = z.infer<typeof crearInsumoSchema>;
export type ActualizarInsumoInput = z.infer<typeof actualizarInsumoSchema>;
export type AjustarStockInsumoInput = z.infer<typeof ajustarStockInsumoSchema>;
export type ActualizarRecetaInput = z.infer<typeof actualizarRecetaSchema>;
