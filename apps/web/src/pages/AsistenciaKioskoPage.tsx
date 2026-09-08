import { useEffect, useState } from "react";
import type { MarcaAsistencia, TipoMarcaAsistencia } from "shared";
import { EstacionHeader } from "../components/EstacionHeader";
import { useAuth } from "../lib/auth";
import { apiFetch, ApiError } from "../lib/api";
import { IconAsistencia, IconCheck, IconLock } from "../components/icons";

export function AsistenciaKioskoPage() {
  const { token } = useAuth();
  const [proximaMarca, setProximaMarca] = useState<TipoMarcaAsistencia | null>(null);
  const [requierePin, setRequierePin] = useState(false);
  const [pin, setPin] = useState("");
  const [ultimaMarca, setUltimaMarca] = useState<MarcaAsistencia | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    try {
      const data = await apiFetch<{ tipo: TipoMarcaAsistencia; requierePin: boolean }>("/asistencia/proxima-marca", token);
      setProximaMarca(data.tipo);
      setRequierePin(data.requierePin);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar tu estado");
    }
  }

  useEffect(() => {
    cargar();
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
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar la marca");
    } finally {
      setEnviando(false);
    }
  }

  const pinIncompleto = requierePin && pin.trim().length < 4;

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
          onClick={marcar}
          disabled={enviando || !proximaMarca || pinIncompleto}
          className={`flex items-center gap-2 rounded-2xl px-8 py-5 text-xl font-bold text-white shadow-lg disabled:opacity-50 ${
            proximaMarca === "SALIDA" ? "bg-red-600 active:bg-red-700" : "bg-emerald-600 active:bg-emerald-700"
          }`}
        >
          <IconCheck width={22} height={22} />
          {enviando ? "Registrando…" : proximaMarca === "SALIDA" ? "Marcar salida" : "Marcar entrada"}
        </button>
      </div>
    </div>
  );
}
