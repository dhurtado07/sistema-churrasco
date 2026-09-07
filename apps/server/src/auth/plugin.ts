import fjwt from "@fastify/jwt";
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Rol } from "shared";
import { env } from "../env.js";

export interface JwtPayload {
  sub: string;
  username: string;
  rol: Rol;
  nombre: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      ...roles: Rol[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.register(fjwt, { secret: env.jwtSecret });

  fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: "No autenticado" });
    }
  });

  fastify.decorate("requireRole", (...roles: Rol[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        reply.code(401).send({ error: "No autenticado" });
        return;
      }
      if (!roles.includes(request.user.rol)) {
        reply.code(403).send({ error: "No autorizado para esta acción" });
      }
    };
  });
});
