import { useConectividad } from "../lib/conectividadContext";
import { IconAlerta } from "./icons";

/** Banner fijo arriba de todo, en cualquier pantalla — aparece solo cuando
 * se pierde la conexión y desaparece solo apenas vuelve (no hace falta
 * recargar la página). Puramente informativo: no bloquea nada por sí mismo,
 * cada pantalla decide qué acciones deshabilitar mientras esté offline. */
export function AvisoSinConexion() {
  const { online } = useConectividad();
  if (online) return null;

  return (
    <div className="no-imprimir fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-1.5 bg-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-md">
      <IconAlerta width={14} height={14} />
      Sin conexión — reintentando…
    </div>
  );
}
