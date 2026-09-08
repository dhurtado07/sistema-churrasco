import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { cambiarMiPasswordSchema, loginSchema, type Rol } from "shared";
import { prisma } from "../../db.js";

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/auth/login",
    {
      // Frena fuerza bruta de contraseñas: bastante generoso para que un
      // puñado de estaciones iniciando sesión juntas al abrir el local (o un
      // usuario que se equivoca un par de veces) nunca lo note, pero corta
      // en seco un intento de adivinar contraseñas a repetición.
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Usuario y contraseña son requeridos" });
      }

      const { username, password } = parsed.data;
      const usuario = await prisma.usuario.findUnique({ where: { username } });

      if (!usuario || !usuario.activo) {
        return reply.code(401).send({ error: "Usuario o contraseña incorrectos" });
      }

      const valido = await bcrypt.compare(password, usuario.passwordHash);
      if (!valido) {
        return reply.code(401).send({ error: "Usuario o contraseña incorrectos" });
      }

      const rol = usuario.rol as Rol;
      const empleado = await prisma.empleado.findUnique({ where: { usuarioId: usuario.id }, select: { id: true } });
      const tieneEmpleado = Boolean(empleado);
      const token = fastify.jwt.sign(
        { sub: usuario.id, username: usuario.username, rol, nombre: usuario.nombre, tieneEmpleado },
        { expiresIn: "12h" },
      );

      return reply.send({
        token,
        usuario: {
          id: usuario.id,
          username: usuario.username,
          rol,
          nombre: usuario.nombre,
          tieneEmpleado,
        },
      });
    },
  );

  fastify.get("/auth/me", { preHandler: [fastify.authenticate] }, async (request) => {
    return request.user;
  });

  // Cualquier cuenta logueada (estación o empleado) puede cambiar su propia
  // contraseña — es la única vía de "recuperación" que tiene sentido en un
  // sistema sin email: si la perdiste del todo, el admin te la resetea desde
  // /admin/usuarios o /admin/empleados.
  fastify.post(
    "/auth/cambiar-password",
    { preHandler: [fastify.authenticate], config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = cambiarMiPasswordSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const usuario = await prisma.usuario.findUnique({ where: { id: request.user.sub } });
      if (!usuario) return reply.code(404).send({ error: "Usuario no encontrado" });

      const valido = await bcrypt.compare(parsed.data.passwordActual, usuario.passwordHash);
      if (!valido) return reply.code(401).send({ error: "La contraseña actual no es correcta" });

      const passwordHash = await bcrypt.hash(parsed.data.passwordNueva, 10);
      await prisma.usuario.update({ where: { id: usuario.id }, data: { passwordHash } });
      return { ok: true };
    },
  );
}
