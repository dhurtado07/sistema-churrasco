import type { ReactNode } from "react";

/**
 * Tooltip accesible al pasar el mouse (o el foco, para teclado): CSS puro con
 * `group-hover`/`group-focus-within`, sin JS ni estado — así no puede quedar
 * "pegado" abierto ni depender de un listener que alguien olvide limpiar.
 * Se usa en encabezados de tabla, íconos y badges para explicar qué es cada
 * columna/opción, sobre todo para alguien nuevo en el sistema.
 */
export function Tooltip({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex items-center focus-within:z-20 hover:z-20">
      <span tabIndex={0} className="inline-flex items-center outline-none">
        {children}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[240px] -translate-x-1/2 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {texto}
        <span className="absolute left-1/2 top-full -ml-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-neutral-900" />
      </span>
    </span>
  );
}
