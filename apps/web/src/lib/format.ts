const formateadorBs = new Intl.NumberFormat("es-BO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatea un monto como se acostumbra en Bolivia: punto para miles, coma
 * para decimales (ej. 1456800 -> "1.456.800,00"). Úsalo en vez de
 * `.toFixed(2)` para cualquier cifra en bolivianos que se muestre en pantalla. */
export function formatBs(valor: number): string {
  return formateadorBs.format(valor);
}

const formateadorFechaHoraBO = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Fecha y hora en horario de Bolivia (America/La_Paz), fijo sin importar en
 * qué huso horario esté configurado el navegador o el servidor — para un
 * ticket impreso esto tiene que ser siempre la hora boliviana real, no la
 * que resulte de cómo esté configurada la máquina. */
export function formatoFechaHoraBO(iso: string): string {
  return formateadorFechaHoraBO.format(new Date(iso));
}

const formateadorClaveDiaBO = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/La_Paz",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Clave de día en horario de Bolivia, "YYYY-MM-DD" (formato en-CA da ese
 * orden) — para agrupar marcas de asistencia por día real de Bolivia, no por
 * el día que resulte de la zona horaria de la máquina. */
export function claveDiaBO(iso: string): string {
  return formateadorClaveDiaBO.format(new Date(iso));
}

/** dd/mm/yyyy a partir de una clave "YYYY-MM-DD" (ya en hora boliviana). */
export function formatoFechaCortaDesdeClaveBO(clave: string): string {
  const [anio, mes, dia] = clave.split("-");
  return `${dia}/${mes}/${anio}`;
}

const formateadorHoraBO = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  hour: "2-digit",
  minute: "2-digit",
});

/** Solo la hora, en horario de Bolivia. */
export function formatoHoraBO(iso: string): string {
  return formateadorHoraBO.format(new Date(iso));
}
