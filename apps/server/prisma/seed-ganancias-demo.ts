// Script puntual para llenar datos de ejemplo en "Ganancias" del día de hoy,
// solo para ver la tabla/filtros con datos reales. No forma parte del seed
// normal (seed.ts) porque crea pedidos falsos, no catálogo base.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const cajero = await prisma.usuario.findFirst({ where: { rol: "cajero" } });
  if (!cajero) throw new Error("No hay usuario cajero — corre el seed principal primero.");

  const productos = await prisma.producto.findMany({ where: { activo: true } });
  if (productos.length === 0) throw new Error("No hay productos — corre el seed principal primero.");

  const porNombre = (n: string) => productos.find((p) => p.nombre === n) ?? productos[0];

  const pedidosDemo = [
    { tipo: "LOCAL", items: [{ p: porNombre("Churrasco Sencillo"), cant: 2 }, { p: porNombre("Gaseosa"), cant: 2 }] },
    { tipo: "LLEVAR", items: [{ p: porNombre("Churrasco Doble Carne"), cant: 1 }, { p: porNombre("Jugo Natural"), cant: 1 }] },
    { tipo: "LOCAL", items: [{ p: porNombre("Pollo a la Parrilla"), cant: 3 }, { p: porNombre("Agua"), cant: 3 }] },
    { tipo: "LOCAL", items: [{ p: porNombre("Costilla BBQ"), cant: 1 }, { p: porNombre("Gaseosa"), cant: 1 }] },
    { tipo: "LLEVAR", items: [{ p: porNombre("Churrasco Sencillo"), cant: 4 }] },
    { tipo: "LOCAL", items: [{ p: porNombre("Plato Vegetariano"), cant: 2 }, { p: porNombre("Jugo Natural"), cant: 2 }] },
    { tipo: "LOCAL", items: [{ p: porNombre("Churrasco Doble Carne"), cant: 2 }, { p: porNombre("Agua"), cant: 2 }] },
    { tipo: "LLEVAR", items: [{ p: porNombre("Pollo a la Parrilla"), cant: 1 }, { p: porNombre("Gaseosa"), cant: 1 }] },
  ] as const;

  const ahora = new Date();

  for (const [i, pedido] of pedidosDemo.entries()) {
    const total = pedido.items.reduce((s, it) => s + it.p.precio * it.cant, 0);
    const completadoEn = new Date(ahora.getTime() - (pedidosDemo.length - i) * 15 * 60_000);
    await prisma.pedido.create({
      data: {
        tipoConsumo: pedido.tipo,
        total,
        estado: "ENTREGADO",
        metodoPago: i % 2 === 0 ? "EFECTIVO" : "QR",
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
  }

  console.log(`Listo: ${pedidosDemo.length} pedidos de ejemplo creados para hoy.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
