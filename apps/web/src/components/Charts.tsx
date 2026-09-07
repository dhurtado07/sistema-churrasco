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

/** Línea de tiempo con varias series — un solo eje (nunca doble eje: todas
 * las series comparten unidad, Bs). Con puntos + tooltip nativo (<title>) y
 * leyenda con swatch de color. */
export function LineaTiempo<T extends { etiqueta: string }>({
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
  const ALTO = 220;
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

  const x = (i: number) => (datos.length === 1 ? PAD_IZQ + anchoUtil / 2 : PAD_IZQ + (i / (datos.length - 1)) * anchoUtil);
  const y = (v: number) => PAD_SUP + altoUtil - ((v - min) / rango) * altoUtil;
  const yCero = y(0);
  const paso = Math.max(1, Math.ceil(datos.length / 7));

  return (
    <div>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full" style={{ maxHeight: 260 }} role="img" aria-label="Gráfico de línea en el tiempo">
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

        {series.map(({ clave, color }) => (
          <polyline
            key={clave}
            points={datos.map((d, i) => `${x(i)},${y(Number(d[clave]) || 0)}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {series.map(({ clave, color, nombre }) =>
          datos.map((d, i) => (
            <circle key={`${clave}-${i}`} cx={x(i)} cy={y(Number(d[clave]) || 0)} r={2.75} fill={color} stroke="#fcfcfb" strokeWidth={1}>
              <title>
                {nombre} · {d.etiqueta}: {formatear(Number(d[clave]) || 0)}
              </title>
            </circle>
          )),
        )}

        {datos.map((d, i) =>
          i % paso === 0 || i === datos.length - 1 ? (
            <text key={d.etiqueta} x={x(i)} y={ALTO - 6} fontSize={9} fill={GRIS_TEXTO} textAnchor="middle">
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
  formatear = (v: number) => `Bs ${v.toFixed(2)}`,
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
 * cargar identidad, solo magnitud. */
export function BarrasRanking<T extends { etiqueta: string; total: number }>({
  datos,
  color = PALETA.azul,
  formatear = (v: number) => `Bs ${v.toFixed(2)}`,
  subEtiqueta,
}: {
  datos: T[];
  color?: string;
  formatear?: (v: number) => string;
  subEtiqueta?: (d: T) => string;
}) {
  if (datos.length === 0) {
    return <p className="text-sm text-neutral-400">Sin datos en este período.</p>;
  }
  const max = Math.max(...datos.map((d) => d.total), 1);
  return (
    <ul className="space-y-2.5">
      {datos.map((d, i) => (
        // Índice + etiqueta (no solo etiqueta): dos productos distintos
        // pueden compartir nombre en datos de prueba/reales.
        <li key={`${i}-${d.etiqueta}`} title={`${d.etiqueta}: ${formatear(d.total)}`}>
          <div className="mb-1 flex items-center justify-between text-xs text-neutral-600">
            <span className="truncate font-medium text-neutral-800">
              {d.etiqueta}
              {subEtiqueta && <span className="ml-1 font-normal text-neutral-400">{subEtiqueta(d)}</span>}
            </span>
            <span className="shrink-0 font-semibold text-neutral-900">{formatear(d.total)}</span>
          </div>
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
  formatear = (v: number) => `Bs ${v.toFixed(2)}`,
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
