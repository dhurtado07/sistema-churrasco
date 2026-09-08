import type { FastifyInstance } from "fastify";
import { generarExcelFinanciero, reporteFinanciero, reporteGanancias } from "./service.js";

// "YYYY-MM-DD" (sin hora) lo interpreta el motor de JS como medianoche UTC, no
// medianoche local — mezclarlo con Date#setHours (que opera en hora local, como
// hacen inicioDelDia/finDelDia en el servicio) desplaza el rango un día entero
// en cualquier servidor cuya zona horaria no sea UTC+0. Por eso un "hoy" con
// fecha explícita podía no encontrar ni un pedido. Se arma la fecha a mano en
// hora local para evitar la ambigüedad.
function parseFechaLocal(str: string): Date {
  const [anio, mes, dia] = str.split("-").map(Number);
  return new Date(anio, (mes ?? 1) - 1, dia ?? 1);
}

function rangoValido(desdeStr?: string, hastaStr?: string): { desde: Date; hasta: Date } | null {
  if (!desdeStr || !hastaStr) return null;
  const desde = new Date(desdeStr);
  const hasta = new Date(hastaStr);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) return null;
  return { desde, hasta };
}

export async function reportesRoutes(fastify: FastifyInstance) {
  fastify.get("/reportes/ganancias", { preHandler: [fastify.requireRole("admin")] }, async (request, reply) => {
    // Acepta ?fecha=YYYY-MM-DD (un solo día, default hoy) o ?desde=...&hasta=... (rango).
    const { fecha, desde, hasta } = request.query as { fecha?: string; desde?: string; hasta?: string };
    const desdeStr = desde ?? fecha;
    const hastaStr = hasta ?? desde ?? fecha;
    const desdeConsulta = desdeStr ? parseFechaLocal(desdeStr) : new Date();
    const hastaConsulta = hastaStr ? parseFechaLocal(hastaStr) : desdeConsulta;
    if (Number.isNaN(desdeConsulta.getTime()) || Number.isNaN(hastaConsulta.getTime())) {
      return reply.code(400).send({ error: "fecha inválida, usar YYYY-MM-DD" });
    }
    return reporteGanancias(desdeConsulta, hastaConsulta);
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
