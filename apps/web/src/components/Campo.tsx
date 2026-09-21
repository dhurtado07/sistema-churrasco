import type { ReactNode } from "react";

/** Etiqueta visible arriba de un input — para que se entienda qué va en cada
 * campo de un vistazo, sin depender del placeholder (que desaparece apenas
 * se empieza a escribir y no sirve para "cómo lleno esto rápido"). */
export function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-600">{etiqueta}</label>
      {children}
    </div>
  );
}
