import type { MarcaAsistencia } from "shared";
import { claveDiaBO } from "./format";

export interface DiaTrabajado {
  clave: string;
  horas: number;
  marcas: MarcaAsistencia[];
}

/** Agrupa las marcas de un empleado por día real de Bolivia y calcula las
 * horas de cada día (mismo criterio de emparejar ENTRADA→SALIDA que usa el
 * servidor para el total, pero día por día) — para ver en qué días trabajó
 * y cuánto cada uno, no solo un total del período que no sirve para calcular
 * qué pagarle si faltó un día o hizo horas distintas cada vez. */
export function agruparPorDia(marcas: MarcaAsistencia[]): DiaTrabajado[] {
  const porDia = new Map<string, MarcaAsistencia[]>();
  for (const marca of marcas) {
    const clave = claveDiaBO(marca.momento);
    const lista = porDia.get(clave) ?? [];
    lista.push(marca);
    porDia.set(clave, lista);
  }

  const dias: DiaTrabajado[] = [];
  for (const [clave, marcasDia] of porDia) {
    const ordenadas = [...marcasDia].sort((a, b) => new Date(a.momento).getTime() - new Date(b.momento).getTime());
    let totalMs = 0;
    let entradaAbierta: number | null = null;
    for (const m of ordenadas) {
      const t = new Date(m.momento).getTime();
      if (m.tipo === "ENTRADA") entradaAbierta = t;
      else if (m.tipo === "SALIDA" && entradaAbierta !== null) {
        totalMs += t - entradaAbierta;
        entradaAbierta = null;
      }
    }
    dias.push({ clave, horas: Math.round((totalMs / 3_600_000) * 100) / 100, marcas: ordenadas });
  }
  return dias.sort((a, b) => b.clave.localeCompare(a.clave));
}

export interface DiaAsistencia extends DiaTrabajado {
  presente: boolean;
}

/** Completa CADA día del período elegido (no solo los que tienen marcas) —
 * agrupar por día solo mostraba cuándo SÍ vino; para saber qué días NO vino
 * hace falta la lista completa del período, con los días sin marcas marcados
 * como ausente en vez de simplemente no aparecer. */
export function diasDelPeriodo(marcas: MarcaAsistencia[], desde: Date, hasta: Date): DiaAsistencia[] {
  const trabajados = new Map(agruparPorDia(marcas).map((d) => [d.clave, d]));
  const dias: DiaAsistencia[] = [];
  const vistos = new Set<string>();
  const cursor = new Date(desde);
  while (cursor <= hasta) {
    const clave = claveDiaBO(cursor.toISOString());
    if (!vistos.has(clave)) {
      vistos.add(clave);
      const trabajado = trabajados.get(clave);
      dias.push({ clave, presente: !!trabajado, horas: trabajado?.horas ?? 0, marcas: trabajado?.marcas ?? [] });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias.sort((a, b) => b.clave.localeCompare(a.clave));
}
