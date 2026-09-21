import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../lib/api";
import { Modal } from "./Modal";
import { IconInput } from "./IconInput";
import { Campo } from "./Campo";
import { IconCheck, IconCoin } from "./icons";

/** Compartido entre Caja (la estación, para abrir su propio turno antes de
 * poder cobrar) y "Caja y dinero" en el admin (para abrirlo/gestionarlo desde
 * el panel) — mismo formulario, mismo endpoint. */
export function AbrirTurnoModal({
  token,
  onCerrar,
  onListo,
}: {
  token: string | null;
  onCerrar: () => void;
  onListo: () => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/caja/turnos", token, {
        method: "POST",
        body: JSON.stringify({ fondoInicial: Number(form.get("fondoInicial")) }),
      });
      onListo();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo abrir el turno");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Abrir turno de caja" onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Campo etiqueta="Fondo inicial en efectivo (Bs)">
          <IconInput icon={IconCoin} name="fondoInicial" type="number" step="0.01" min="0" placeholder="0.00" required autoFocus />
        </Campo>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={guardando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <IconCheck width={16} height={16} />
          {guardando ? "Abriendo…" : "Confirmar apertura"}
        </button>
      </form>
    </Modal>
  );
}
