import type { FastifyInstance } from "fastify";
import { generarExcelFinanciero, reporteFinanciero, reporteGanancias } from "./service.js";

function rangoValido(desdeStr?: string, hastaStr?: string): { desde: Date; hasta: Date } | null {
  if (!desdeStr || !hastaStr) return null;
  const desde = new Date(desdeStr);
  const hasta = new Date(hastaStr);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) return null;
  return { desde, hasta };
}

export async function reportesRoutes(fastify: FastifyInstance) {
  fastify.get("/reportes/ganancias", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const { fecha } = request.query as { fecha?: string };
    const fechaConsulta = fecha ? new Date(fecha) : new Date();
    if (Number.isNaN(fechaConsulta.getTime())) {
      return reply.code(400).send({ error: "fecha inválida, usar YYYY-MM-DD" });
    }
    return reporteGanancias(fechaConsulta);
  });

  fastify.get("/reportes/financiero", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const { desde, hasta, agrupar } = request.query as { desde?: string; hasta?: string; agrupar?: string };
    const rango = rangoValido(desde, hasta);
    if (!rango) return reply.code(400).send({ error: "desde y hasta son requeridos (ISO 8601)" });

    const bucket = agrupar === "semana" || agrupar === "mes" ? agrupar : "dia";
    return reporteFinanciero(rango.desde, rango.hasta, bucket);
  });

  fastify.get("/reportes/financiero/excel", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    const { desde, hasta, agrupar } = request.query as { desde?: string; hasta?: string; agrupar?: string };
    const rango = rangoValido(desde, hasta);
    if (!rango) return reply.code(400).send({ error: "desde y hasta son requeridos (ISO 8601)" });

    const bucket = agrupar === "semana" || agrupar === "mes" ? agrupar : "dia";
    const buffer = await generarExcelFinanciero(rango.desde, rango.hasta, bucket);
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", "attachment; filename=reporte-financiero.xlsx");
    return reply.send(buffer);
  });
}
