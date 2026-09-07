import type { FastifyInstance } from "fastify";
import { crearProductoSchema, actualizarProductoSchema, crearExtraSchema, actualizarExtraSchema, actualizarRecetaSchema } from "shared";
import { prisma } from "../../db.js";
import { realtime } from "../../ws/socket.js";
import { actualizarReceta, InsumoValidationError, obtenerReceta } from "../insumos/service.js";

async function broadcastMenu() {
  const [productos, extras] = await Promise.all([
    prisma.producto.findMany({ orderBy: { categoria: "asc" } }),
    prisma.extra.findMany({ orderBy: { nombre: "asc" } }),
  ]);
  realtime.menuActualizado({ productos, extras });
}

export async function menuRoutes(fastify: FastifyInstance) {
  fastify.get("/menu", { preHandler: [fastify.authenticate] }, async () => {
    const [productos, extras] = await Promise.all([
      prisma.producto.findMany({ where: { activo: true }, orderBy: { categoria: "asc" } }),
      prisma.extra.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    ]);
    return { productos, extras };
  });

  // --- Sitio público (sin login) — menú y datos del negocio para /menu ---

  fastify.get("/publico/menu", async () => {
    const [productos, extras] = await Promise.all([
      prisma.producto.findMany({ where: { activo: true }, orderBy: { categoria: "asc" } }),
      prisma.extra.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    ]);
    return { productos, extras };
  });

  fastify.get("/publico/negocio", async () => {
    const config = await prisma.configuracion.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
    return {
      nombreNegocio: config.nombreNegocio,
      direccion: config.direccion,
      telefono: config.telefono,
      logoUrl: config.logoUrl,
    };
  });

  // --- Administración de menú (solo admin) ---

  fastify.get("/admin/menu", { preHandler: [fastify.requireRole("admin")] }, async () => {
    const [productos, extras] = await Promise.all([
      prisma.producto.findMany({ orderBy: { categoria: "asc" } }),
      prisma.extra.findMany({ orderBy: { nombre: "asc" } }),
    ]);
    return { productos, extras };
  });

  fastify.post("/admin/productos", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const parsed = crearProductoSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const producto = await prisma.producto.create({ data: parsed.data });
    await broadcastMenu();
    return reply.code(201).send(producto);
  });

  fastify.patch("/admin/productos/:id", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = actualizarProductoSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const producto = await prisma.producto.update({ where: { id }, data: parsed.data });
    await broadcastMenu();
    return producto;
  });

  fastify.post("/admin/extras", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const parsed = crearExtraSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const extra = await prisma.extra.create({ data: parsed.data });
    await broadcastMenu();
    return reply.code(201).send(extra);
  });

  fastify.patch("/admin/extras/:id", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = actualizarExtraSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const extra = await prisma.extra.update({ where: { id }, data: parsed.data });
    await broadcastMenu();
    return extra;
  });

  // --- Receta (BOM) de un producto — cuánto de cada insumo consume, para
  // descontar stock automático en cada venta (ver /admin/insumos). ---

  fastify.get("/admin/productos/:id/receta", { preHandler: [fastify.requireRole("admin")] }, async (request) => {
    const { id } = request.params as { id: string };
    return obtenerReceta(id);
  });

  fastify.put("/admin/productos/:id/receta", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = actualizarRecetaSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      return await actualizarReceta(id, parsed.data);
    } catch (error) {
      if (error instanceof InsumoValidationError) return reply.code(409).send({ error: error.message });
      throw error;
    }
  });
}
