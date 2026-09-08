import { useEffect, useState } from "react";
import type { HorasTrabajadasEmpleado, MarcaAsistencia, TipoMarcaAsistencia } from "shared";
import { EstacionHeader } from "../components/EstacionHeader";
import { useAuth } from "../lib/auth";
import { apiFetch, ApiError } from "../lib/api";
import { formatoFechaCortaDesdeClaveBO, formatoHoraBO } from "../lib/format";
import { diasDelPeriodo } from "../lib/asistencia";
import { IconAsistencia, IconCheck, IconLock } from "../components/icons";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { Th, FilaVacia, Paginacion } from "../components/TablaSeccion";

// Desde el día 1 del mes hasta HOY — nunca hasta el fin de mes calendario:
// un día que todavía no llegó no puede figurar como "Ausente" en la tabla de
// días. Mismo criterio que ya usa el preset "Este mes" del admin en Reportes.
function rangoMesActual(): { desde: Date; hasta: Date } {
  const ahora = new Date();
  const desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const hasta = new Date(ahora);
  hasta.setHours(23, 59, 59, 999);
  return { desde, hasta };
}

export function AsistenciaKioskoPage() {
  const { token } = useAuth();
  const [proximaMarca, setProximaMarca] = useState<TipoMarcaAsistencia | null>(null);
  const [requierePin, setRequierePin] = useState(false);
  const [pin, setPin] = useState("");
  const [ultimaMarca, setUltimaMarca] = useState<MarcaAsistencia | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [misHoras, setMisHoras] = useState<HorasTrabajadasEmpleado | null>(null);
  const [mostrarDias, setMostrarDias] = useState(false);
  const [mostrandoConfirmacion, setMostrandoConfirmacion] = useState(false);
  const [paginaMisHoras, setPaginaMisHoras] = useState(1);
  const [tamanoPaginaMisHoras, setTamanoPaginaMisHoras] = useState(15);

  const { desde, hasta } = rangoMesActual();

  async function cargar() {
    try {
      const data = await apiFetch<{ tipo: TipoMarcaAsistencia; requierePin: boolean }>("/asistencia/proxima-marca", token);
      setProximaMarca(data.tipo);
      setRequierePin(data.requierePin);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar tu estado");
    }
  }

  async function cargarMisHoras() {
    try {
      setMisHoras(
        await apiFetch<HorasTrabajadasEmpleado>(
          `/asistencia/mis-horas?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`,
          token,
        ),
      );
    } catch {
      // No bloquea el flujo principal de marcar entrada/salida si esto falla.
    }
  }

  useEffect(() => {
    cargar();
    cargarMisHoras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function marcar() {
    setEnviando(true);
    setError(null);
    try {
      const marca = await apiFetch<MarcaAsistencia>("/asistencia/marcar", token, {
        method: "POST",
        body: JSON.stringify({ pin: requierePin ? pin : undefined }),
      });
      setUltimaMarca(marca);
      setPin("");
      setMostrandoConfirmacion(false);
      await cargar();
      await cargarMisHoras();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar la marca");
    } finally {
      setEnviando(false);
    }
  }

  const pinIncompleto = requierePin && pin.trim().length < 4;
  const todosLosDias = misHoras ? diasDelPeriodo(misHoras.marcas, desde, hasta) : [];
  const totalPaginasMisHoras = Math.max(1, Math.ceil(todosLosDias.length / tamanoPaginaMisHoras));
  const dias = mostrarDias
    ? todosLosDias.slice((paginaMisHoras - 1) * tamanoPaginaMisHoras, paginaMisHoras * tamanoPaginaMisHoras)
    : [];

  return (
    <div className="min-h-dvh bg-neutral-100">
      <EstacionHeader titulo="Asistencia" mostrarVerPedidos={false} />

      <div className="flex flex-col items-center justify-center gap-6 p-6 pt-16 text-center">
        <IconAsistencia width={56} height={56} className="text-neutral-400" />

        {ultimaMarca ? (
          <div>
            <p className="text-lg font-semibold text-emerald-600">
              {ultimaMarca.tipo === "ENTRADA" ? "Entrada registrada" : "Salida registrada"}
            </p>
            <p className="text-sm text-neutral-500">{new Date(ultimaMarca.momento).toLocaleString("es-BO")}</p>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Marcá tu {proximaMarca === "SALIDA" ? "salida" : "entrada"} al llegar o al irte de tu turno.</p>
        )}

        {requierePin && !ultimaMarca && (
          <div className="w-full max-w-[220px]">
            <label className="mb-1 flex items-center justify-center gap-1.5 text-xs font-medium text-neutral-500">
              <IconLock width={13} height={13} />
              Ingresá tu PIN para confirmar
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-center text-2xl tracking-[0.4em]"
              placeholder="••••"
              autoFocus
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={() => setMostrandoConfirmacion(true)}
          disabled={enviando || !proximaMarca || pinIncompleto}
          className={`flex items-center gap-2 rounded-2xl px-8 py-5 text-xl font-bold text-white shadow-lg disabled:opacity-50 ${
            proximaMarca === "SALIDA" ? "bg-red-600 active:bg-red-700" : "bg-emerald-600 active:bg-emerald-700"
          }`}
        >
          <IconCheck width={22} height={22} />
          {proximaMarca === "SALIDA" ? "Marcar salida" : "Marcar entrada"}
        </button>

        {mostrandoConfirmacion && (
          <ConfirmActionModal
            titulo={proximaMarca === "SALIDA" ? "Confirmar salida" : "Confirmar entrada"}
            mensaje={
              <>
                ¿Confirmás tu <strong>{proximaMarca === "SALIDA" ? "salida" : "entrada"}</strong> ahora, a las{" "}
                {new Date().toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}? Esto queda
                registrado para calcular tus horas trabajadas.
              </>
            }
            textoConfirmar={enviando ? "Registrando…" : proximaMarca === "SALIDA" ? "Sí, marcar salida" : "Sí, marcar entrada"}
            tono={proximaMarca === "SALIDA" ? "red" : "green"}
            cargando={enviando}
            error={error}
            onConfirmar={marcar}
            onCancelar={() => setMostrandoConfirmacion(false)}
          />
        )}

        {misHoras && (
          <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm">
            <button
              onClick={() => setMostrarDias((v) => !v)}
              className="flex w-full items-center justify-between gap-2"
            >
              <span>
                <p className="text-sm font-semibold text-neutral-900">Mis horas este mes</p>
                <p className="text-xs text-neutral-500">{mostrarDias ? "ocultar días ▲" : "ver días ▼"}</p>
              </span>
              <span className="text-xl font-bold text-neutral-900">{misHoras.horas.toFixed(1)} h</span>
            </button>

            {mostrarDias && (
              <div className="mt-3 border-t border-neutral-100 pt-3">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-100">
                        <Th>Día</Th>
                        <Th>Estado</Th>
                        <Th>Marcas (entrada/salida)</Th>
                        <Th align="right">Horas</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {dias.map((d) => (
                        <tr key={d.clave}>
                          <td className="px-3 py-2 text-sm font-medium text-neutral-900">
                            {formatoFechaCortaDesdeClaveBO(d.clave)}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                d.presente ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-500"
                              }`}
                            >
                              {d.presente ? "Presente" : "Ausente"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-neutral-500">
                            {d.marcas.length > 0
                              ? d.marcas
                                  .map((m) => `${m.tipo === "ENTRADA" ? "E" : "S"} ${formatoHoraBO(m.momento)}`)
                                  .join(" · ")
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-semibold text-neutral-900">
                            {d.presente ? `${d.horas.toFixed(1)} h` : "—"}
                          </td>
                        </tr>
                      ))}
                      {todosLosDias.length === 0 && (
                        <FilaVacia colSpan={4}>Este mes todavía no tiene días.</FilaVacia>
                      )}
                    </tbody>
                  </table>
                </div>
                <Paginacion
                  pagina={paginaMisHoras}
                  totalPaginas={totalPaginasMisHoras}
                  totalItems={todosLosDias.length}
                  tamano={tamanoPaginaMisHoras}
                  tamanosDisponibles={[15, 30, 60]}
                  onCambiarPagina={setPaginaMisHoras}
                  onCambiarTamano={(t) => {
                    setTamanoPaginaMisHoras(t);
                    setPaginaMisHoras(1);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
