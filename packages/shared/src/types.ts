export type Rol = "cajero" | "cocina" | "parrilla" | "entrega" | "admin" | "impresora" | "empleado";

export type TipoConsumo = "LOCAL" | "LLEVAR";

export type EstadoPedido = "PAGADO" | "COMPLETADO" | "ENTREGADO" | "CANCELADO";

export type MetodoPago = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "QR";

export type TipoMovimientoCaja = "INGRESO" | "EGRESO";

export type CategoriaMovimientoCaja =
  | "VENTA"
  | "COMPRA_INSUMO"
  | "PAGO_PROVEEDOR"
  | "SUELDO"
  | "SERVICIO"
  | "OTRO";

export type EstadoCajaTurno = "ABIERTO" | "CERRADO";

export type EstadoActivoInventario = "BUENO" | "REGULAR" | "MALO" | "BAJA";

export type TipoMarcaAsistencia = "ENTRADA" | "SALIDA";

export type OrigenMarcaAsistencia = "KIOSKO" | "MANUAL";

export interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
  activo: boolean;
  requiereParrilla: boolean;
  imagenUrl: string | null;
}

export interface Cliente {
  id: string;
  nombre: string;
  carnet: string | null;
  creadoEn: string;
}

export interface Extra {
  id: string;
  nombre: string;
  precio: number;
  activo: boolean;
  imagenUrl: string | null;
}

export interface ExtraSeleccionado {
  extraId: string;
  nombre: string;
  precio: number;
}

export interface ItemPedido {
  id: string;
  productoId: string;
  nombreProducto: string;
  imagenUrl: string | null;
  requiereParrilla: boolean;
  cantidad: number;
  precioUnitario: number;
  extras: ExtraSeleccionado[];
}

export interface Pedido {
  id: string;
  folio: number;
  clienteId: string | null;
  clienteNombre: string | null;
  clienteCarnet: string | null;
  tipoConsumo: TipoConsumo;
  mesa: string | null;
  items: ItemPedido[];
  total: number;
  estado: EstadoPedido;
  metodoPago: MetodoPago;
  requiereParrilla: boolean;
  cocinaLista: boolean;
  parrillaLista: boolean;
  cajeroUsername: string;
  creadoEn: string;
  cocinaListaEn: string | null;
  parrillaListaEn: string | null;
  completadoEn: string | null;
  entregadoEn: string | null;
}

/** Ítem de pedido tal como quedó "congelado" en un snapshot de auditoría —
 * más liviano que ItemPedido (sin ids), solo lo necesario para mostrar qué
 * cambió. */
export interface ItemAuditado {
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  extras: string[];
}

export interface PedidoAuditoria {
  id: string;
  pedidoId: number;
  usuarioNombre: string;
  accion: "EDITADO" | "CANCELADO";
  itemsAntes: ItemAuditado[];
  itemsDespues: ItemAuditado[] | null;
  totalAntes: number;
  totalDespues: number | null;
  creadoEn: string;
}

export interface Usuario {
  id: string;
  username: string;
  rol: Rol;
  nombre: string;
}

/** Cuenta de estación (cajero, cocina, parrilla, entrega, admin, impresora) —
 * gestionada desde /admin/usuarios. Distinta de Empleado, que es una cuenta
 * individual solo para marcar asistencia. */
export interface UsuarioEstacion {
  id: string;
  username: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  creadoEn: string;
}

export interface Configuracion {
  cocinaHabilitada: boolean;
  parrillaHabilitada: boolean;
  entregaHabilitada: boolean;
  nombreNegocio: string;
  direccion: string | null;
  telefono: string | null;
  nit: string | null;
  logoUrl: string | null;
}

export interface ReporteGanancias {
  fecha: string;
  totalVendido: number;
  cantidadPedidos: number;
  porTipoConsumo: Record<TipoConsumo, number>;
  porProducto: { productoId: string; nombre: string; cantidad: number; total: number }[];
}

// ---------------------------------------------------------------------------
// Caja y dinero
// ---------------------------------------------------------------------------

export interface CajaTurno {
  id: string;
  abiertoPorNombre: string;
  fondoInicial: number;
  abiertoEn: string;
  estado: EstadoCajaTurno;
  cerradoPorNombre: string | null;
  efectivoContado: number | null;
  efectivoEsperado: number | null;
  diferencia: number | null;
  notaCierre: string | null;
  cerradoEn: string | null;
}

export interface MovimientoCaja {
  id: string;
  turnoId: string | null;
  tipo: TipoMovimientoCaja;
  categoria: CategoriaMovimientoCaja;
  concepto: string;
  monto: number;
  metodoPago: MetodoPago | null;
  pedidoId: number | null;
  compraId: string | null;
  registradoPorNombre: string;
  anulaMovimientoId: string | null;
  anulado: boolean;
  creadoEn: string;
}

// ---------------------------------------------------------------------------
// Compras, proveedores e inventario
// ---------------------------------------------------------------------------

export interface Proveedor {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  categoria: string | null;
  activo: boolean;
}

export interface CompraItem {
  id: string;
  insumo: string;
  categoria: string | null;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  subtotal: number;
  insumoId: string | null;
}

export interface Compra {
  id: string;
  proveedorId: string | null;
  proveedorNombre: string | null;
  fecha: string;
  total: number;
  notas: string | null;
  registradoPorNombre: string;
  items: CompraItem[];
}

// ---------------------------------------------------------------------------
// Insumos (stock) y recetas
// ---------------------------------------------------------------------------

export interface Insumo {
  id: string;
  nombre: string;
  categoria: string | null;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
  creadoEn: string;
}

export interface RecetaItem {
  insumoId: string;
  insumoNombre: string;
  unidad: string;
  cantidadPorUnidad: number;
}

export interface ActivoInventario {
  id: string;
  nombre: string;
  categoria: string | null;
  cantidad: number;
  estado: EstadoActivoInventario;
  valorUnitario: number | null;
  fechaAdquisicion: string | null;
  notas: string | null;
  activo: boolean;
}

// ---------------------------------------------------------------------------
// Empleados y asistencia
// ---------------------------------------------------------------------------

export interface Empleado {
  id: string;
  usuarioId: string;
  username: string;
  nombre: string;
  puesto: string;
  sueldo: number;
  fechaContratacion: string | null;
  telefono: string | null;
  activo: boolean;
  /** true si tiene un PIN configurado para confirmar identidad al marcar
   * asistencia (nunca se expone el PIN en sí, solo si existe). */
  tienePin: boolean;
}

export interface MarcaAsistencia {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  tipo: TipoMarcaAsistencia;
  momento: string;
  origen: OrigenMarcaAsistencia;
}

export interface HorasTrabajadasEmpleado {
  empleadoId: string;
  empleadoNombre: string;
  puesto: string;
  sueldo: number;
  horas: number;
  marcas: MarcaAsistencia[];
}

// ---------------------------------------------------------------------------
// Reportes financieros
// ---------------------------------------------------------------------------

export interface PuntoSerieFinanciera {
  etiqueta: string;
  ingresos: number;
  egresos: number;
  ganancia: number;
}

export interface ReporteFinanciero {
  desde: string;
  hasta: string;
  totalIngresos: number;
  totalEgresos: number;
  totalInversionInsumos: number;
  gananciaNeta: number;
  porCategoriaEgreso: { categoria: CategoriaMovimientoCaja; total: number }[];
  porMetodoPago: { metodoPago: MetodoPago; total: number }[];
  serie: PuntoSerieFinanciera[];
  /** Ventas por tipo de consumo (local vs. para llevar) de los pedidos
   * completados en el período — para el dashboard del dueño. */
  porTipoConsumo: Record<TipoConsumo, number>;
  /** Top productos vendidos en el período (por monto), de mayor a menor. */
  porProducto: { productoId: string; nombre: string; cantidad: number; total: number }[];
}
