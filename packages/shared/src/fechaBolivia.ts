/** Fechas del negocio, siempre en horario de Bolivia (America/La_Paz, UTC-4 fijo:
 * no tiene horario de verano) sin importar la zona del navegador o del servidor.
 *
 * Por qué existe: `new Date().toISOString().slice(0, 10)` da la fecha en UTC, y
 * desde las 8 pm de Bolivia ya es "mañana" — "Ganancias de hoy" mostraba un día
 * vacío por las noches, y los reportes por día pasaban las ventas de la noche al
 * día siguiente. */

const ZONA = "America/La_Paz";
const formateadorDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha de hoy en Bolivia, "YYYY-MM-DD". */
export function hoyBolivia(ahora: Date = new Date()): string {
  return formateadorDia.format(ahora);
}

/** Fecha "YYYY-MM-DD" de un instante, en horario de Bolivia. */
export function fechaBolivia(instante: Date): string {
  return formateadorDia.format(instante);
}

/** Suma (o resta) días a una fecha "YYYY-MM-DD" — aritmética de calendario pura. */
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

export function primerDiaDelMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

export function primerDiaDelAnio(fecha: string): string {
  return `${fecha.slice(0, 4)}-01-01`;
}

/** Primer instante de ese día en Bolivia. */
export function inicioDelDiaBolivia(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000-04:00`);
}

/** Último instante de ese día en Bolivia. */
export function finDelDiaBolivia(fecha: string): Date {
  return new Date(`${fecha}T23:59:59.999-04:00`);
}
