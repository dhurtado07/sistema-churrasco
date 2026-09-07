import type { SVGProps } from "react";
import { Tooltip } from "./Tooltip";
import { IconInfo } from "./icons";
import { ACENTOS, type Acento } from "./TablaSeccion";

/** Tarjeta de KPI con ícono de color y un tooltip que explica qué significa
 * el número — para que el dueño (o cualquiera nuevo) entienda qué está
 * mirando sin tener que adivinar. */
export function StatCard({
  icono: Icono,
  acento,
  label,
  value,
  hint,
}: {
  icono: (props: SVGProps<SVGSVGElement>) => JSX.Element;
  acento: Acento;
  label: string;
  value: string;
  hint?: string;
}) {
  const paleta = ACENTOS[acento];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${paleta.icono}`}>
        <Icono width={18} height={18} />
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-xs text-neutral-500">
          {label}
          {hint && (
            <Tooltip texto={hint}>
              <IconInfo width={12} height={12} className="text-neutral-400" />
            </Tooltip>
          )}
        </p>
        <p className={`truncate text-lg font-bold ${paleta.texto}`}>{value}</p>
      </div>
    </div>
  );
}
