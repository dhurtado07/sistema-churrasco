import type { ReactNode } from "react";

/**
 * Tooltip accesible al pasar el mouse (o el foco, para teclado): CSS puro con
 * `group-hover`/`group-focus-within`, sin JS ni estado — así no puede quedar
 * "pegado" abierto ni depender de un listener que alguien olvide limpiar.
 * Se usa en encabezados de tabla, íconos y badges para explicar qué es cada
 * columna/opción, sobre todo para alguien nuevo en el sistema.
 */
export function Tooltip({
  texto,
  children,
  posicion = "arriba",
}: {
  texto: string;
  children: ReactNode;
  /** "abajo" evita que el tooltip se recorte cuando el elemento está pegado al borde
   * superior de un contenedor con scroll propio (ej. encabezados de tabla con overflow-x-auto,
   * que por CSS también recorta en el eje vertical). */
  posicion?: "arriba" | "abajo";
}) {
  const esAbajo = posicion === "abajo";
  return (
    <span className="group relative inline-flex items-center focus-within:z-20 hover:z-20">
      <span tabIndex={0} className="inline-flex items-center outline-none">
        {children}
      </span>
      <span
        role="tooltip"
        // whitespace-normal: el disparador puede estar dentro de un <th> con
        // whitespace-nowrap (para que el encabezado no salte de línea), y ese
        // white-space se hereda — sin esto, el texto del tooltip queda forzado
        // a una sola línea y se corta contra el borde del contenedor en vez de
        // bajar de línea.
        className={`pointer-events-none absolute left-1/2 z-20 w-max max-w-[160px] -translate-x-1/2 whitespace-normal rounded-lg bg-neutral-900 px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:max-w-[240px] ${
          esAbajo ? "top-full mt-2" : "bottom-full mb-2"
        }`}
      >
        {texto}
        <span
          className={`absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-neutral-900 ${
            esAbajo ? "bottom-full -mb-1" : "top-full -mt-1"
          }`}
        />
      </span>
    </span>
  );
}
