import type { EstadoCarga } from "../lib/useListaRemota";

/**
 * Lo que se muestra en el lugar de una lista vacía. Solo dice `vacio` (ej.
 * "No hay pedidos pendientes.") cuando el servidor respondió de verdad; antes
 * de eso, o si no hay conexión, muestra que está cargando/reintentando, para
 * que nadie confunda "todavía no llegó" con "no hay nada".
 */
export function EstadoCargaLista({
  estado,
  error,
  cargando = "Cargando pedidos…",
  vacio,
  className = "",
}: {
  estado: EstadoCarga;
  error: string | null;
  cargando?: string;
  vacio: string;
  className?: string;
}) {
  if (estado === "listo") {
    return <p className={`text-neutral-400 ${className}`}>{vacio}</p>;
  }

  const texto =
    estado === "cargando"
      ? cargando
      : error
        ? `${error} — reintentando…`
        : "Sin conexión con el servidor — reintentando…";

  return (
    <div role="status" className={`flex items-center justify-center gap-3 py-6 text-neutral-500 ${className}`}>
      <span
        aria-hidden
        className="h-6 w-6 shrink-0 animate-spin rounded-full border-[3px] border-neutral-300 border-t-neutral-800"
      />
      <span className={estado === "error" ? "text-amber-700" : ""}>{texto}</span>
    </div>
  );
}
