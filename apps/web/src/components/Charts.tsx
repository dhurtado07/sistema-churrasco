import { formatBs } from "../lib/format";

// Gráficos hechos a mano con SVG/CSS puro (sin librería): el proyecto ya
// venía así (ver GraficoSerie original) — se mantiene el enfoque porque no
// depende de ResizeObserver ni mediciones en JS, así que no puede "temblar"
// al redibujar. Paleta categórica validada (contraste + daltonismo) — ver la
// skill de dataviz: azul/naranja/aqua/amarillo/magenta en orden fijo por
// entidad, nunca por posición, para que agregar/quitar una categoría no
// repinte las demás.
export const PALETA = {
  azul: "#2a78d6",
  naranja: "#eb6834",
  aqua: "#1baf7a",
  amarillo: "#eda100",
  magenta: "#e87ba4",
  verde: "#008300",
  violeta: "#4a3aa7",
  rojo: "#e34948",
} as const;

const GRIS_EJE = "#c3c2b7";
const GRIS_GRILLA = "#e1e0d9";
const GRIS_TEXTO = "#898781";

/** Camino de una barra vertical con esquinas redondeadas solo en el extremo
 * "de dato" (arriba si es positiva, abajo si es negativa) y esquina recta
 * pegada a la línea base — nunca al revés, para que se note de dónde "crece"
 * cada barra. */
function caminoBarra(x: number, ancho: number, yBase: number, yDato: number, radio: number): string {
  const positiva = yDato < yBase;
  const alto = Math.abs(yBase - yDato);
  const r = Math.min(radio, ancho / 2, alto);
  if (r <= 0.5) {
    return `M${x},${yBase} H${x + ancho} V${yDato} H${x} Z`;
  }
  if (positiva) {
    return `M${x},${yBase} V${yDato + r} Q${x},${yDato} ${x + r},${yDato} H${x + ancho - r} Q${x + ancho},${yDato} ${x + ancho},${yDato + r} V${yBase} Z`;
  }
  return `M${x},${yBase} V${yDato - r} Q${x},${yDato} ${x + r},${yDato} H${x + ancho - r} Q${x + ancho},${yDato} ${x + ancho},${yDato - r} V${yBase} Z`;
}

/** Barras agrupadas por período — para comparar varias series de la misma
 * unidad a lo largo del tiempo cuando alguna puede ser negativa (ej. ganancia
 * neta un día en rojo). Mucho más fácil de leer que líneas superpuestas
 * cuando hay pocos puntos en el eje X: cada período es un grupito de barras
 * una al lado de la otra, no algo que hay que "seguir" cruzando el gráfico. */
export function BarrasAgrupadas<T extends { etiqueta: string }>({
  datos,
  series,
  formatear = (v: number) => v.toFixed(0),
}: {
  datos: T[];
  series: { clave: keyof T & string; color: string; nombre: string }[];
  formatear?: (v: number) => string;
}) {
  if (datos.length === 0) {
    return <p className="text-sm text-neutral-400">Sin datos en este período.</p>;
  }

  const ANCHO = 640;
  const ALTO = 240;
  const PAD_IZQ = 56;
  const PAD_DER = 12;
  const PAD_SUP = 14;
  const PAD_INF = 26;
  const anchoUtil = ANCHO - PAD_IZQ - PAD_DER;
  const altoUtil = ALTO - PAD_SUP - PAD_INF;

  const valores = datos.flatMap((d) => series.map((s) => Number(d[s.clave]) || 0));
  const max = Math.max(...valores, 0);
  const min = Math.min(...valores, 0);
  const rango = max - min || 1;

  const y = (v: number) => PAD_SUP + altoUtil - ((v - min) / rango) * altoUtil;
  const yCero = y(0);

  const anchoGrupo = anchoUtil / datos.length;
  const GAP = 2; // separador entre barras vecinas dentro de un mismo grupo
  const anchoBarra = Math.min(24, (anchoGrupo * 0.75 - GAP * (series.length - 1)) / series.length);
  const anchoCluster = anchoBarra * series.length + GAP * (series.length - 1);
  const paso = Math.max(1, Math.ceil(datos.length / 7));

  return (
    <div>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full" style={{ maxHeight: 280 }} role="img" aria-label="Gráfico de barras agrupadas por período">
        <line x1={PAD_IZQ} y1={PAD_SUP} x2={PAD_IZQ} y2={PAD_SUP + altoUtil} stroke={GRIS_GRILLA} strokeWidth={1} />
        <line x1={PAD_IZQ} y1={yCero} x2={ANCHO - PAD_DER} y2={yCero} stroke={GRIS_EJE} strokeWidth={1} />
        <text x={2} y={PAD_SUP + 4} fontSize={10} fill={GRIS_TEXTO}>
          {formatear(max)}
        </text>
        <text x={2} y={yCero + 4} fontSize={10} fill={GRIS_TEXTO}>
          {formatear(0)}
        </text>
        {min < 0 && (
          <text x={2} y={PAD_SUP + altoUtil} fontSize={10} fill={GRIS_TEXTO}>
            {formatear(min)}
          </text>
        )}

        {datos.map((d, i) => {
          const inicioCluster = PAD_IZQ + i * anchoGrupo + (anchoGrupo - anchoCluster) / 2;
          return (
            <g key={d.etiqueta}>
              {series.map((s, j) => {
                const valor = Number(d[s.clave]) || 0;
                const xBarra = inicioCluster + j * (anchoBarra + GAP);
                return (
                  <path key={s.clave} d={caminoBarra(xBarra, anchoBarra, yCero, y(valor), 4)} fill={s.color}>
                    <title>
                      {s.nombre} · {d.etiqueta}: {formatear(valor)}
                    </title>
                  </path>
                );
              })}
            </g>
          );
        })}

        {datos.map((d, i) =>
          i % paso === 0 || i === datos.length - 1 ? (
            <text
              key={d.etiqueta}
              x={PAD_IZQ + i * anchoGrupo + anchoGrupo / 2}
              y={ALTO - 6}
              fontSize={9}
              fill={GRIS_TEXTO}
              textAnchor="middle"
            >
              {String(d.etiqueta).length === 7 ? String(d.etiqueta).slice(5) : String(d.etiqueta).slice(5).replace("-", "/")}
            </text>
          ) : null,
        )}
      </svg>
      <Leyenda items={series.map((s) => ({ color: s.color, etiqueta: s.nombre }))} />
    </div>
  );
}

export function Leyenda({ items }: { items: { color: string; etiqueta: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-600">
      {items.map((it) => (
        <span key={it.etiqueta} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: it.color }} />
          {it.etiqueta}
        </span>
      ))}
    </div>
  );
}

/** Barras horizontales por categoría — cada categoría tiene SIEMPRE el mismo
 * color (viene del mapa `colorPorClave`, no de su posición), con espacio de
 * 2px de "respiro" contra la barra siguiente y extremo redondeado. */
export function BarrasCategoria({
  datos,
  colorPorClave,
  formatear = (v: number) => `Bs ${formatBs(v)}`,
}: {
  datos: { clave: string; etiqueta: string; total: number }[];
  colorPorClave: Record<string, string>;
  formatear?: (v: number) => string;
}) {
  if (datos.length === 0) {
    return <p className="text-sm text-neutral-400">Sin datos en este período.</p>;
  }
  const max = Math.max(...datos.map((d) => d.total), 1);
  return (
    <ul className="space-y-2.5">
      {datos.map((d) => {
        const color = colorPorClave[d.clave] ?? PALETA.azul;
        return (
          <li key={d.clave} title={`${d.etiqueta}: ${formatear(d.total)}`}>
            <div className="mb-1 flex items-center justify-between text-xs text-neutral-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                {d.etiqueta}
              </span>
              <span className="font-medium text-neutral-900">{formatear(d.total)}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${Math.max((d.total / max) * 100, 2)}%`, backgroundColor: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Barras de "ranking" de un solo color — para cuando cada barra ya se
 * identifica por su etiqueta (ej. nombre de producto) y el color no necesita
 * cargar identidad, solo magnitud. Cada fila se muestra como líneas
 * etiquetadas explícitas (ej. "Plato: X" / "Cantidad de platos vendidos: N" /
 * "Total: Bs Y") en vez de un solo renglón compacto, para que el número no
 * quede ambiguo (¿es plata? ¿es cantidad?). */
export function BarrasRanking<T extends { etiqueta: string; total: number }>({
  datos,
  color = PALETA.azul,
  formatear = (v: number) => `Bs ${formatBs(v)}`,
  etiquetaPrefijo = "",
  detalle,
}: {
  datos: T[];
  color?: string;
  formatear?: (v: number) => string;
  /** Antepuesto al nombre de cada fila, ej. "Plato: ". */
  etiquetaPrefijo?: string;
  /** Línea de detalle propia debajo del nombre, ya con su etiqueta (ej. "Cantidad de platos vendidos: 12"). */
  detalle?: (d: T) => string;
}) {
  if (datos.length === 0) {
    return <p className="text-sm text-neutral-400">Sin datos en este período.</p>;
  }
  const max = Math.max(...datos.map((d) => d.total), 1);
  return (
    <ul className="space-y-3.5">
      {datos.map((d, i) => (
        // Índice + etiqueta (no solo etiqueta): dos productos distintos
        // pueden compartir nombre en datos de prueba/reales.
        <li key={`${i}-${d.etiqueta}`}>
          <p className="truncate text-xs text-neutral-500">
            {etiquetaPrefijo}
            <span className="font-semibold text-neutral-900">{d.etiqueta}</span>
          </p>
          {detalle && <p className="text-xs text-neutral-500">{detalle(d)}</p>}
          <p className="mb-1 text-xs text-neutral-500">
            Total: <span className="font-semibold text-neutral-900">{formatear(d.total)}</span>
          </p>
          <div className="h-3 w-full rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max((d.total / max) * 100, 2)}%`, backgroundColor: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Dona (donut) — para composición de una magnitud en pocas categorías
 * (método de pago, tipo de consumo). Etiquetado directo en la leyenda +
 * total en el centro; nunca solo color para distinguir series. */
export function Dona({
  datos,
  colorPorClave,
  formatear = (v: number) => `Bs ${formatBs(v)}`,
  centroLabel,
}: {
  datos: { clave: string; etiqueta: string; total: number }[];
  colorPorClave: Record<string, string>;
  formatear?: (v: number) => string;
  centroLabel?: string;
}) {
  const total = datos.reduce((s, d) => s + d.total, 0);
  if (datos.length === 0 || total <= 0) {
    return <p className="text-sm text-neutral-400">Sin datos en este período.</p>;
  }

  const R = 42;
  const GROSOR = 16;
  const CIRC = 2 * Math.PI * R;
  let acumulado = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg viewBox="0 0 100 100" width={140} height={140} role="img" aria-label="Gráfico de composición">
        <circle cx="50" cy="50" r={R} fill="none" stroke="#f0efec" strokeWidth={GROSOR} />
        {datos.map((d) => {
          const frac = d.total / total;
          const largo = Math.max(frac * CIRC - 2, 0); // -2: respiro de 2px entre segmentos
          const offset = CIRC - acumulado;
          acumulado += frac * CIRC;
          const color = colorPorClave[d.clave] ?? PALETA.azul;
          return (
            <circle
              key={d.clave}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={color}
              strokeWidth={GROSOR}
              strokeDasharray={`${largo} ${CIRC - largo}`}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
              strokeLinecap="round"
            >
              <title>
                {d.etiqueta}: {formatear(d.total)} ({(frac * 100).toFixed(0)}%)
              </title>
            </circle>
          );
        })}
        <text x="50" y="47" textAnchor="middle" fontSize="9" fill={GRIS_TEXTO}>
          {centroLabel ?? "Total"}
        </text>
        <text x="50" y="58" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#0b0b0b">
          {formatear(total)}
        </text>
      </svg>
      <ul className="w-full space-y-1.5 text-xs">
        {datos.map((d) => {
          const color = colorPorClave[d.clave] ?? PALETA.azul;
          const pct = (d.total / total) * 100;
          return (
            <li key={d.clave} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5 text-neutral-700">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <span className="truncate">{d.etiqueta}</span>
              </span>
              <span className="shrink-0 font-medium text-neutral-900">
                {formatear(d.total)} <span className="text-neutral-400">({pct.toFixed(0)}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
