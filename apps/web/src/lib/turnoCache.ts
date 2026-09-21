import type { CajaTurno } from "shared";

const CLAVE = "churrasco.ultimoTurnoConocido";

/** Último estado del turno de caja que el servidor confirmó — si se corta la
 * conexión justo al entrar a Caja (o en cualquier momento), esto es lo que
 * se usa para decidir si se puede seguir vendiendo sin poder preguntarle al
 * servidor "¿hay un turno abierto ahora?". */
export function guardarUltimoTurnoConocido(turno: CajaTurno | null) {
  try {
    if (turno) {
      localStorage.setItem(CLAVE, JSON.stringify(turno));
    } else {
      localStorage.removeItem(CLAVE);
    }
  } catch {
    // localStorage lleno/bloqueado — sin cache no hay turno offline, pero no
    // afecta el uso normal con conexión.
  }
}

export function leerUltimoTurnoConocido(): CajaTurno | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as CajaTurno) : null;
  } catch {
    return null;
  }
}
