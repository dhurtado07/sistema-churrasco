import type { ReactNode, SVGProps } from "react";
import { Tooltip } from "./Tooltip";
import { IconInfo } from "./icons";

/**
 * Paleta de acentos por sección — clases completas y estáticas (Tailwind
 * necesita ver el nombre de la clase tal cual en el código para no purgarla
 * en el build; por eso no se arma con interpolación de string).
 */
export const ACENTOS = {
  esmeralda: { icono: "bg-emerald-100 text-emerald-600", franja: "bg-emerald-500", texto: "text-emerald-600" },
  azul: { icono: "bg-blue-100 text-blue-600", franja: "bg-blue-500", texto: "text-blue-600" },
  ambar: { icono: "bg-amber-100 text-amber-600", franja: "bg-amber-500", texto: "text-amber-600" },
  naranja: { icono: "bg-orange-100 text-orange-600", franja: "bg-orange-500", texto: "text-orange-600" },
  violeta: { icono: "bg-violet-100 text-violet-600", franja: "bg-violet-500", texto: "text-violet-600" },
  cian: { icono: "bg-cyan-100 text-cyan-600", franja: "bg-cyan-500", texto: "text-cyan-600" },
  rosa: { icono: "bg-pink-100 text-pink-600", franja: "bg-pink-500", texto: "text-pink-600" },
  indigo: { icono: "bg-indigo-100 text-indigo-600", franja: "bg-indigo-500", texto: "text-indigo-600" },
  teal: { icono: "bg-teal-100 text-teal-600", franja: "bg-teal-500", texto: "text-teal-600" },
  rojo: { icono: "bg-red-100 text-red-600", franja: "bg-red-500", texto: "text-red-600" },
  gris: { icono: "bg-neutral-200 text-neutral-600", franja: "bg-neutral-400", texto: "text-neutral-600" },
} as const;

export type Acento = keyof typeof ACENTOS;

/**
 * Tarjeta estándar para toda lista/tabla del panel: ícono de color + título +
 * descripción arriba, una fila de filtros/acciones siempre visible (nunca
 * escondida en un menú), y la tabla (o lo que sea) como contenido. Los
 * filtros van con scroll horizontal propio en mobile para que la tabla ancha
 * no rompa el layout de la página.
 */
export function TablaSeccion({
  icono: Icono,
  acento,
  titulo,
  descripcion,
  filtros,
  acciones,
  className = "",
  children,
}: {
  icono: (props: SVGProps<SVGSVGElement>) => JSX.Element;
  acento: Acento;
  titulo: string;
  descripcion?: string;
  /** Controles de filtro — siempre visibles, nunca detrás de un botón. */
  filtros?: ReactNode;
  /** Botones de acción (ej. "Nuevo…"), a la derecha del título. */
  acciones?: ReactNode;
  /** Clases extra para el <section> raíz (ej. `lg:col-span-2` en un grid). */
  className?: string;
  children: ReactNode;
}) {
  const paleta = ACENTOS[acento];
  return (
    // Sin overflow-hidden: recortaría cualquier tooltip que se salga del borde de la
    // tarjeta (ver Tooltip.tsx). La franja de color se redondea a mano en sus propias
    // esquinas superiores para que igual respete el borde redondeado de la tarjeta.
    <section className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      <div className={`h-1 w-full rounded-t-2xl ${paleta.franja}`} />
      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${paleta.icono}`}>
              <Icono width={20} height={20} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-neutral-900">{titulo}</h2>
              {descripcion && <p className="mt-0.5 max-w-md text-xs text-neutral-500">{descripcion}</p>}
            </div>
          </div>
          {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
        </div>

        {filtros && (
          <div className="mb-3 flex flex-wrap items-center gap-2 overflow-x-auto border-b border-neutral-100 pb-3">
            {filtros}
          </div>
        )}

        {children}
      </div>
    </section>
  );
}

/** Celda de encabezado de tabla, con un ícono de info + tooltip opcional que
 * explica qué es esa columna — para que alguien nuevo en el sistema entienda
 * qué está viendo sin tener que preguntar. */
export function Th({
  children,
  hint,
  align = "left",
  className = "",
}: {
  children: ReactNode;
  hint?: string;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const alineacion = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th
      className={`whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 ${alineacion} ${className}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
        {children}
        {hint && (
          // Tooltip hacia abajo: un <th> siempre está pegado al borde superior de la tabla,
          // y ese borde suele estar dentro de un contenedor con overflow-x-auto — que por
          // CSS también recorta el eje vertical, así que uno abriendo hacia arriba no se ve.
          <Tooltip texto={hint} posicion="abajo">
            <IconInfo width={13} height={13} className="text-neutral-400" />
          </Tooltip>
        )}
      </span>
    </th>
  );
}

/** Input de búsqueda estándar para la fila de filtros — mismo look en toda la app. */
export function FiltroBusqueda({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <svg
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
      >
        <circle cx="9" cy="9" r="5.5" />
        <path d="M13.2 13.2 17 17" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-neutral-300 py-1.5 pl-8 pr-3 text-xs sm:w-56"
      />
    </div>
  );
}

/** Botón de filtro tipo "chip" (para estado, tipo, período, etc.) — el
 * seleccionado se resalta con el color de acento de la sección. */
export function FiltroChip({
  activo,
  onClick,
  acento = "esmeralda",
  children,
}: {
  activo: boolean;
  onClick: () => void;
  acento?: Acento;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        activo ? `${ACENTOS[acento].icono} ring-1 ring-inset ring-current` : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}

const TONOS_BADGE = {
  verde: "bg-emerald-100 text-emerald-700",
  ambar: "bg-amber-100 text-amber-700",
  rojo: "bg-red-100 text-red-700",
  azul: "bg-sky-100 text-sky-700",
  gris: "bg-neutral-100 text-neutral-500",
  violeta: "bg-violet-100 text-violet-700",
} as const;

/** Badge (pill) de estado, opcionalmente con tooltip explicando qué significa. */
export function Badge({
  tono,
  hint,
  children,
}: {
  tono: keyof typeof TONOS_BADGE;
  hint?: string;
  children: ReactNode;
}) {
  const pill = (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONOS_BADGE[tono]}`}>
      {children}
    </span>
  );
  return hint ? <Tooltip texto={hint}>{pill}</Tooltip> : pill;
}

/** Controles de paginación estándar: selector de tamaño de página + anterior/siguiente. */
export function Paginacion({
  pagina,
  totalPaginas,
  totalItems,
  tamano,
  onCambiarPagina,
  onCambiarTamano,
  tamanosDisponibles = [25, 50, 100],
}: {
  pagina: number;
  totalPaginas: number;
  totalItems: number;
  tamano: number;
  onCambiarPagina: (pagina: number) => void;
  onCambiarTamano: (tamano: number) => void;
  tamanosDisponibles?: number[];
}) {
  if (totalItems === 0) return null;
  const inicio = (pagina - 1) * tamano + 1;
  const fin = Math.min(pagina * tamano, totalItems);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
      <div className="flex items-center gap-1.5">
        <span>Mostrar</span>
        <select
          value={tamano}
          onChange={(e) => onCambiarTamano(Number(e.target.value))}
          className="rounded-lg border border-neutral-300 px-1.5 py-1 text-xs"
        >
          {tamanosDisponibles.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span>
          por página · {inicio}–{fin} de {totalItems}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={pagina <= 1}
          onClick={() => onCambiarPagina(pagina - 1)}
          className="rounded-lg border border-neutral-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Anterior
        </button>
        <span>
          Página {pagina} de {totalPaginas}
        </span>
        <button
          type="button"
          disabled={pagina >= totalPaginas}
          onClick={() => onCambiarPagina(pagina + 1)}
          className="rounded-lg border border-neutral-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

/** Fila "vacío" que ocupa todo el ancho de la tabla. */
export function FilaVacia({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-neutral-400">
        {children}
      </td>
    </tr>
  );
}
