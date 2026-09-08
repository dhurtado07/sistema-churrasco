import { forwardRef, type InputHTMLAttributes } from "react";
import type { SVGProps } from "react";

interface IconInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
}

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(function IconInput(
  { icon: Icon, className = "", ...props },
  ref,
) {
  // `className` (típicamente un margen o un ancho, ej. "mb-4") va en este div
  // envolvente, no en el <input> — si se aplicara al input, su margen agranda
  // el alto de este contenedor "relative" sin agrandar el del input, y el
  // ícono (centrado con top-1/2 respecto al contenedor) queda descentrado
  // hacia abajo, pegado al borde inferior en vez de centrado en el campo.
  return (
    <div className={`relative ${className}`}>
      <Icon
        width={16}
        height={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
      />
      <input
        ref={ref}
        {...props}
        className="w-full rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm"
      />
    </div>
  );
});
