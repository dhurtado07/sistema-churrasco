import type { CajaTurno } from "shared";
import { formatBs } from "../lib/format";

/** Franja delgada bajo el encabezado de Caja: deja siempre a la vista si la
 * caja está abierta (y con cuánto se abrió) o cerrada, y permite abrirla o
 * cerrarla desde ahí. `turno`: undefined = todavía no se sabe (no se muestra
 * nada para no parpadear), null = caja cerrada. */
export function BannerTurno({
  turno,
  online,
  onAbrir,
  onCerrar,
}: {
  turno: CajaTurno | null | undefined;
  online: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
}) {
  if (turno === undefined) return null;

  const abierta = turno !== null;
  const hora = abierta
    ? new Date(turno.abiertoEn).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-1.5 text-xs font-medium text-white sm:px-4 ${
        abierta ? "bg-emerald-600" : "bg-red-600"
      }`}
    >
      <span>
        {abierta
          ? `Caja abierta · desde las ${hora} · fondo inicial Bs ${formatBs(turno.fondoInicial)}`
          : "Caja cerrada — no se puede cobrar hasta abrirla"}
      </span>
      <button
        type="button"
        onClick={abierta ? onCerrar : onAbrir}
        // Cerrar necesita al servidor (calcula el efectivo esperado y entrega
        // los pedidos pendientes); sin conexión se sigue vendiendo normal.
        disabled={abierta && !online}
        title={abierta && !online ? "Cerrar caja necesita conexión" : undefined}
        className="rounded bg-white/20 px-2.5 py-0.5 font-semibold hover:bg-white/30 disabled:opacity-50"
      >
        {abierta ? "Cerrar caja" : "Abrir caja"}
      </button>
    </div>
  );
}
