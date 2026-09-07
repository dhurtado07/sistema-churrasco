import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertUsuario(
  username: string,
  password: string,
  nombre: string,
  rol: "cajero" | "cocina" | "parrilla" | "entrega" | "admin" | "impresora" | "empleado",
) {
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.usuario.upsert({
    where: { username },
    update: {},
    create: { username, passwordHash, nombre, rol },
  });
}

// Fotos de Wikimedia Commons (dominio público / licencias libres, URLs
// estables vía upload.wikimedia.org) — solo para tener el menú con imágenes
// desde el arranque y probar el flujo completo. En uso real, cada negocio
// sube sus propias fotos desde el modal "+ Nuevo producto" en /admin/productos
// (se redimensionan y quedan guardadas como parte del producto, sin depender
// de un link externo).
const IMG = {
  churrascoSencillo:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Grilling_steak.jpg/500px-Grilling_steak.jpg",
  churrascoDoble:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Steak_auf_Grill.jpg/500px-Steak_auf_Grill.jpg",
  pollo:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Grilled_Chicken_Breasts_%2828905381261%29.jpg/500px-Grilled_Chicken_Breasts_%2828905381261%29.jpg",
  costillaBbq:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Ribs_in_a_barbecue_%22pit%22.jpg/500px-Ribs_in_a_barbecue_%22pit%22.jpg",
  vegetariano:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Mixed_green_salad.jpg/500px-Mixed_green_salad.jpg",
  gaseosa:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Tumbler_of_cola_with_ice.jpg/500px-Tumbler_of_cola_with_ice.jpg",
  jugo: "https://upload.wikimedia.org/wikipedia/commons/0/03/A_glass_of_orange_juice_%282014-12-23%29.JPG",
  agua: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Glass-of-water.jpg/500px-Glass-of-water.jpg",
  arroz:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Bowl_of_white_rice_02.jpg/500px-Bowl_of_white_rice_02.jpg",
  chorizo: "https://upload.wikimedia.org/wikipedia/commons/1/10/Chorizo_Chuquisaque%C3%B1o.jpg",
  papa: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Pommes-1.jpg/500px-Pommes-1.jpg",
  ensalada: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Composed_salad.jpg/500px-Composed_salad.jpg",
} as const;

async function main() {
  await Promise.all([
    upsertUsuario("cajero", "cajero123", "Caja Principal", "cajero"),
    upsertUsuario("cocina", "cocina123", "Cocina", "cocina"),
    upsertUsuario("parrilla", "parrilla123", "Parrilla", "parrilla"),
    upsertUsuario("entrega", "entrega123", "Entrega", "entrega"),
    upsertUsuario("admin", "admin123", "Administrador", "admin"),
    upsertUsuario("impresora", "impresora123", "Agente de Impresión (Caja)", "impresora"),
  ]);

  await prisma.configuracion.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", nombreNegocio: "BRASA ARISP" },
  });

  const empleadoUsername = "parrillero1";
  const empleadoPasswordHash = await bcrypt.hash("empleado123", 10);
  const usuarioEmpleado = await prisma.usuario.upsert({
    where: { username: empleadoUsername },
    update: {},
    create: {
      username: empleadoUsername,
      passwordHash: empleadoPasswordHash,
      nombre: "Carlos Mamani",
      rol: "empleado",
    },
  });
  await prisma.empleado.upsert({
    where: { usuarioId: usuarioEmpleado.id },
    update: {},
    create: {
      usuarioId: usuarioEmpleado.id,
      puesto: "Parrillero",
      sueldo: 2800,
      fechaContratacion: new Date("2025-01-15"),
    },
  });

  const proveedoresCount = await prisma.proveedor.count();
  if (proveedoresCount === 0) {
    await prisma.proveedor.createMany({
      data: [
        { nombre: "Carnicería El Novillo", categoria: "carne", contacto: "Don Ramiro", telefono: "70011122" },
        { nombre: "Mercado Central - Verduras", categoria: "verdura", contacto: "Doña Elena", telefono: "70099887" },
        { nombre: "Distribuidora Abarrotes SRL", categoria: "abarrote", telefono: "70055443" },
      ],
    });
  }

  const productosCount = await prisma.producto.count();
  if (productosCount === 0) {
    await prisma.producto.createMany({
      data: [
        { nombre: "Churrasco Sencillo", categoria: "Platos", precio: 45, requiereParrilla: true, imagenUrl: IMG.churrascoSencillo },
        { nombre: "Churrasco Doble Carne", categoria: "Platos", precio: 65, requiereParrilla: true, imagenUrl: IMG.churrascoDoble },
        { nombre: "Pollo a la Parrilla", categoria: "Platos", precio: 40, requiereParrilla: true, imagenUrl: IMG.pollo },
        { nombre: "Costilla BBQ", categoria: "Platos", precio: 55, requiereParrilla: true, imagenUrl: IMG.costillaBbq },
        { nombre: "Plato Vegetariano", categoria: "Platos", precio: 30, requiereParrilla: false, imagenUrl: IMG.vegetariano },
        { nombre: "Gaseosa", categoria: "Bebidas", precio: 8, requiereParrilla: false, imagenUrl: IMG.gaseosa },
        { nombre: "Jugo Natural", categoria: "Bebidas", precio: 10, requiereParrilla: false, imagenUrl: IMG.jugo },
        { nombre: "Agua", categoria: "Bebidas", precio: 5, requiereParrilla: false, imagenUrl: IMG.agua },
      ],
    });
  }

  const extrasCount = await prisma.extra.count();
  if (extrasCount === 0) {
    await prisma.extra.createMany({
      data: [
        { nombre: "Arroz", precio: 5, imagenUrl: IMG.arroz },
        { nombre: "Chorizo", precio: 12, imagenUrl: IMG.chorizo },
        { nombre: "Papa", precio: 6, imagenUrl: IMG.papa },
        { nombre: "Ensalada", precio: 5, imagenUrl: IMG.ensalada },
      ],
    });
  }

  const clientesCount = await prisma.cliente.count();
  if (clientesCount === 0) {
    await prisma.cliente.createMany({
      data: [
        { nombre: "Juan Pérez", carnet: "1234567" },
        { nombre: "María López", carnet: "7654321" },
      ],
    });
  }
}

main()
  .then(() => {
    console.log("Seed completo");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
