/**
 * Barra de pestañas de sección (ej. "Financiero" / "Nómina", "Directorio" /
 * "Asistencia") — pestaña de carpeta/navegador de verdad: la activa queda
 * "levantada" en blanco, cortando la línea inferior; las inactivas quedan
 * planas sobre esa línea. Nada que ver con un FiltroChip (que es un filtro
 * dentro de una pestaña, no para cambiar de sección).
 */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (valor: T) => void;
  tabs: { value: T; label: string }[];
}) {
  return (
    <div className="flex gap-1 border-b border-neutral-200 no-imprimir">
      {tabs.map((t) => {
        const activo = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`-mb-px rounded-t-lg border-x border-t px-4 py-2.5 text-sm font-semibold transition-colors ${
              activo
                ? "border-neutral-200 bg-white text-neutral-900 shadow-sm"
                : "border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
