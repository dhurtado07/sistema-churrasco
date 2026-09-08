import type { ReactNode } from "react";
import { Modal } from "./Modal";
import { IconAlerta } from "./icons";

/**
 * Modal de confirmación genérico para acciones críticas (activar/desactivar,
 * anular, etc.) — nunca ejecutar de un solo toque en un botón/badge, siempre
 * pasar por acá primero. Reutilizado en Productos, Extras, Empleados,
 * Proveedores, Usuarios de estación.
 */
export function ConfirmActionModal({
  titulo,
  mensaje,
  textoConfirmar,
  tono = "red",
  cargando,
  error,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  mensaje: ReactNode;
  textoConfirmar: string;
  /** "red" para una acción que apaga/quita algo, "green" para una que lo prende/agrega. */
  tono?: "red" | "green";
  cargando: boolean;
  error?: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <Modal titulo={titulo} onCerrar={onCancelar}>
      <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-800">
        <IconAlerta width={20} height={20} className="mt-0.5 shrink-0" />
        <p className="text-sm">{mensaje}</p>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={onCancelar}
          disabled={cargando}
          className="flex-1 rounded-lg bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-700 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirmar}
          disabled={cargando}
          className={`flex-1 rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 ${
            tono === "red" ? "bg-red-600" : "bg-emerald-600"
          }`}
        >
          {cargando ? "Guardando…" : textoConfirmar}
        </button>
      </div>
    </Modal>
  );
}
