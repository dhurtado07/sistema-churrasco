// Script puntual: la base de datos de desarrollo acumuló miles de registros de
// pruebas anteriores (6564 pedidos, 16k+ items, 29 productos, etc.) — esto
// resetea todo a un puñado de datos limpios (~5 por tabla) para poder probar
// la interfaz sin ruido. No es parte del seed normal (seed.ts).
//
// Se conservan intactas las 6 cuentas de estación (cajero/cocina/parrilla/
// entrega/admin/impresora) — son infraestructura de login, no "datos de
// prueba" a recortar; si se borran, esa estación deja de poder iniciar sesión.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const USERNAMES_CORE = ["cajero", "cocina", "parrilla", "entrega", "admin", "impresora"];

async function main() {
  console.log("Borrando datos transaccionales…");
  await prisma.movimientoCaja.deleteMany({});
  await prisma.itemPedidoExtra.deleteMany({});
  await prisma.itemPedido.deleteMany({});
  await prisma.pedidoAuditoria.deleteMany({});
  await prisma.pedido.deleteMany({});
  await prisma.compraItem.deleteMany({});
  await prisma.compra.deleteMany({});
  await prisma.cajaTurno.deleteMany({});
  await prisma.recetaItem.deleteMany({});
  await prisma.asistencia.deleteMany({});
  await prisma.empleado.deleteMany({});
  await prisma.usuario.deleteMany({ where: { username: { notIn: USERNAMES_CORE } } });
  await prisma.activoInventario.deleteMany({});
  await prisma.cliente.deleteMany({});
  await prisma.proveedor.deleteMany({});
  await prisma.extra.deleteMany({});
  await prisma.producto.deleteMany({});
  await prisma.insumo.deleteMany({});

  console.log("Recreando catálogo (5 productos, 4 extras, 5 insumos)…");
  const IMG = {
    churrasco: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Grilling_steak.jpg/500px-Grilling_steak.jpg",
    pollo:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Grilled_Chicken_Breasts_%2828905381261%29.jpg/500px-Grilled_Chicken_Breasts_%2828905381261%29.jpg",
    costilla: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Ribs_in_a_barbecue_%22pit%22.jpg/500px-Ribs_in_a_barbecue_%22pit%22.jpg",
    gaseosa: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Tumbler_of_cola_with_ice.jpg/500px-Tumbler_of_cola_with_ice.jpg",
    jugo: "https://upload.wikimedia.org/wikipedia/commons/0/03/A_glass_of_orange_juice_%282014-12-23%29.JPG",
    arroz: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Bowl_of_white_rice_02.jpg/500px-Bowl_of_white_rice_02.jpg",
    chorizo: "https://upload.wikimedia.org/wikipedia/commons/1/10/Chorizo_Chuquisaque%C3%B1o.jpg",
    papa: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Pommes-1.jpg/500px-Pommes-1.jpg",
    ensalada: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Composed_salad.jpg/500px-Composed_salad.jpg",
  };

  const productos = await Promise.all(
    [
      { nombre: "Churrasco Sencillo", categoria: "Platos", precio: 45, requiereParrilla: true, imagenUrl: IMG.churrasco },
      { nombre: "Pollo a la Parrilla", categoria: "Platos", precio: 40, requiereParrilla: true, imagenUrl: IMG.pollo },
      { nombre: "Costilla BBQ", categoria: "Platos", precio: 55, requiereParrilla: true, imagenUrl: IMG.costilla },
      { nombre: "Gaseosa", categoria: "Bebidas", precio: 8, requiereParrilla: false, imagenUrl: IMG.gaseosa },
      { nombre: "Jugo Natural", categoria: "Bebidas", precio: 10, requiereParrilla: false, imagenUrl: IMG.jugo },
    ].map((p) => prisma.producto.create({ data: p })),
  );

  await Promise.all(
    [
      { nombre: "Arroz", precio: 5, imagenUrl: IMG.arroz },
      { nombre: "Chorizo", precio: 12, imagenUrl: IMG.chorizo },
      { nombre: "Papa", precio: 6, imagenUrl: IMG.papa },
      { nombre: "Ensalada", precio: 5, imagenUrl: IMG.ensalada },
    ].map((e) => prisma.extra.create({ data: e })),
  );

  await prisma.insumo.createMany({
    data: [
      { nombre: "Carne de res", unidad: "kg", stockActual: 25, stockMinimo: 5, categoria: "carne" },
      { nombre: "Pollo", unidad: "kg", stockActual: 20, stockMinimo: 5, categoria: "carne" },
      { nombre: "Arroz", unidad: "kg", stockActual: 30, stockMinimo: 8, categoria: "abarrote" },
      { nombre: "Papa", unidad: "kg", stockActual: 40, stockMinimo: 10, categoria: "verdura" },
      { nombre: "Chorizo", unidad: "kg", stockActual: 15, stockMinimo: 4, categoria: "carne" },
    ],
  });

  console.log("Recreando 5 proveedores, 5 clientes…");
  await prisma.proveedor.createMany({
    data: [
      { nombre: "Carnicería El Novillo", categoria: "carne", contacto: "Don Ramiro", telefono: "70011122" },
      { nombre: "Mercado Central - Verduras", categoria: "verdura", contacto: "Doña Elena", telefono: "70099887" },
      { nombre: "Distribuidora Abarrotes SRL", categoria: "abarrote", telefono: "70055443" },
      { nombre: "Avícola San José", categoria: "carne", contacto: "Don José", telefono: "70033221" },
      { nombre: "Bebidas del Valle", categoria: "abarrote", telefono: "70044556" },
    ],
  });
  const clientes = await Promise.all(
    [
      { nombre: "Juan Pérez", carnet: "1234567" },
      { nombre: "María López", carnet: "7654321" },
      { nombre: "Carlos Vargas", carnet: "2345678" },
      { nombre: "Ana Quispe", carnet: "3456789" },
      { nombre: "Luis Mamani", carnet: "4567890" },
    ].map((c) => prisma.cliente.create({ data: c })),
  );

  console.log("Recreando 5 empleados…");
  for (const [i, emp] of [
    { username: "empleado1", nombre: "Carlos Mamani", puesto: "Parrillero", sueldo: 2800 },
    { username: "empleado2", nombre: "Rosa Flores", puesto: "Cocinera", sueldo: 2600 },
    { username: "empleado3", nombre: "Pedro Choque", puesto: "Mesero", sueldo: 2200 },
    { username: "empleado4", nombre: "Elena Quiroga", puesto: "Cajera", sueldo: 2500 },
    { username: "empleado5", nombre: "Miguel Torrez", puesto: "Ayudante de cocina", sueldo: 2100 },
  ].entries()) {
    const passwordHash = await bcrypt.hash("empleado123", 10);
    const usuario = await prisma.usuario.create({
      data: { username: emp.username, passwordHash, nombre: emp.nombre, rol: "empleado" },
    });
    await prisma.empleado.create({
      data: { usuarioId: usuario.id, puesto: emp.puesto, sueldo: emp.sueldo, fechaContratacion: new Date(2025, 0, 15 + i) },
    });
  }

  console.log("Recreando 5 activos de inventario…");
  await prisma.activoInventario.createMany({
    data: [
      { nombre: "Mesas de madera", categoria: "Mobiliario", cantidad: 10, estado: "BUENO" },
      { nombre: "Sillas plásticas", categoria: "Mobiliario", cantidad: 40, estado: "BUENO" },
      { nombre: "Parrilla industrial", categoria: "Cocina", cantidad: 1, estado: "BUENO" },
      { nombre: "Refrigerador", categoria: "Cocina", cantidad: 2, estado: "BUENO" },
      { nombre: "Televisor", categoria: "Electrónica", cantidad: 1, estado: "REGULAR" },
    ],
  });

  const cajero = await prisma.usuario.findFirstOrThrow({ where: { username: "cajero" } });

  console.log("Recreando 5 compras…");
  const proveedores = await prisma.proveedor.findMany();
  for (let i = 0; i < 5; i++) {
    const cantidad = 10 + i;
    const precioUnitario = 15 + i;
    const subtotal = cantidad * precioUnitario;
    const proveedor = proveedores[i % proveedores.length];
    const compra = await prisma.compra.create({
      data: {
        proveedorId: proveedor.id,
        proveedorNombre: proveedor.nombre,
        total: subtotal,
        registradoPorId: cajero.id,
        items: { create: [{ insumo: "Carne de res", cantidad, unidad: "kg", precioUnitario, subtotal }] },
      },
    });
    // Cada compra real genera su egreso en el libro de caja (ver
    // caja/service.ts#registrarEgresoCompra) — se replica acá para que
    // Reportes/Caja y dinero no queden vacíos con este catálogo de prueba.
    await prisma.movimientoCaja.create({
      data: {
        tipo: "EGRESO",
        categoria: "COMPRA_INSUMO",
        concepto: `Compra a ${proveedor.nombre}`,
        monto: subtotal,
        compraId: compra.id,
        registradoPorId: cajero.id,
        creadoEn: compra.fecha,
      },
    });
  }

  console.log("Recreando 5 pedidos de hoy…");
  const pedidosDemo = [
    { tipo: "LOCAL", clienteId: clientes[0].id, items: [{ p: productos[0], cant: 2 }, { p: productos[3], cant: 2 }] },
    { tipo: "LLEVAR", clienteId: clientes[1].id, items: [{ p: productos[1], cant: 1 }, { p: productos[4], cant: 1 }] },
    { tipo: "LOCAL", clienteId: null, items: [{ p: productos[2], cant: 1 }, { p: productos[3], cant: 1 }] },
    { tipo: "LOCAL", clienteId: clientes[2].id, items: [{ p: productos[0], cant: 3 }] },
    { tipo: "LLEVAR", clienteId: null, items: [{ p: productos[1], cant: 2 }, { p: productos[4], cant: 2 }] },
  ] as const;

  const ahora = new Date();
  for (const [i, pedido] of pedidosDemo.entries()) {
    const total = pedido.items.reduce((s, it) => s + it.p.precio * it.cant, 0);
    const completadoEn = new Date(ahora.getTime() - (pedidosDemo.length - i) * 20 * 60_000);
    const metodoPago = i % 2 === 0 ? "EFECTIVO" : "QR";
    const creado = await prisma.pedido.create({
      data: {
        clienteId: pedido.clienteId,
        tipoConsumo: pedido.tipo,
        total,
        estado: "ENTREGADO",
        metodoPago,
        requiereParrilla: pedido.items.some((it) => it.p.requiereParrilla),
        cocinaLista: true,
        parrillaLista: true,
        cajeroId: cajero.id,
        creadoEn: completadoEn,
        cocinaListaEn: completadoEn,
        parrillaListaEn: completadoEn,
        completadoEn,
        entregadoEn: completadoEn,
        items: {
          create: pedido.items.map((it) => ({
            productoId: it.p.id,
            nombreProducto: it.p.nombre,
            imagenUrl: it.p.imagenUrl,
            requiereParrilla: it.p.requiereParrilla,
            cantidad: it.cant,
            precioUnitario: it.p.precio,
          })),
        },
      },
    });
    // Cada venta real genera su ingreso en el libro de caja (ver
    // caja/service.ts#registrarVentaPedido) — se replica acá para que
    // "Caja y dinero"/Reportes no queden vacíos con este catálogo de prueba.
    await prisma.movimientoCaja.create({
      data: {
        tipo: "INGRESO",
        categoria: "VENTA",
        concepto: `Venta pedido #${creado.id}`,
        monto: total,
        metodoPago,
        pedidoId: creado.id,
        registradoPorId: cajero.id,
        creadoEn: completadoEn,
      },
    });
  }

  console.log("Listo: base de datos reseteada a datos limpios de prueba.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
