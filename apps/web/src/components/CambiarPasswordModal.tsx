import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { apiFetch, ApiError } from "../lib/api";
import { Modal } from "./Modal";
import { IconInput } from "./IconInput";
import { IconCheck, IconLock } from "./icons";

/** Disponible para cualquier cuenta logueada (estación o empleado) — es la
 * única "recuperación de contraseña" que tiene sentido sin un sistema de
 * email: cambiarla vos mismo sabiendo la actual, o pedirle al admin que te
 * la resetee desde /admin/usuarios o /admin/empleados si la olvidaste del
 * todo. */
export function CambiarPasswordModal({ onCerrar }: { onCerrar: () => void }) {
  const { token } = useAuth();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const nueva = String(form.get("passwordNueva") ?? "");
    const confirmacion = String(form.get("confirmacion") ?? "");
    if (nueva !== confirmacion) {
      setError("La confirmación no coincide con la contraseña nueva.");
      setGuardando(false);
      return;
    }
    try {
      await apiFetch("/auth/cambiar-password", token, {
        method: "POST",
        body: JSON.stringify({ passwordActual: form.get("passwordActual"), passwordNueva: nueva }),
      });
      setListo(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Cambiar mi contraseña" onCerrar={onCerrar}>
      {listo ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-emerald-700">Contraseña actualizada ✓</p>
          <button
            onClick={onCerrar}
            className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white"
          >
            Listo
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <IconInput icon={IconLock} name="passwordActual" type="password" placeholder="Contraseña actual" required autoFocus />
          <IconInput icon={IconLock} name="passwordNueva" type="password" placeholder="Contraseña nueva (mín. 6 caracteres)" required minLength={6} />
          <IconInput icon={IconLock} name="confirmacion" type="password" placeholder="Repetir contraseña nueva" required minLength={6} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={guardando}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            <IconCheck width={16} height={16} />
            {guardando ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </form>
      )}
    </Modal>
  );
}
