import { useState } from "react";
import { useAuth } from "../lib/auth";
import { IconLock, IconLogout } from "./icons";
import { CambiarPasswordModal } from "./CambiarPasswordModal";

export function EstacionHeader({ titulo }: { titulo: string }) {
  const { usuario, logout } = useAuth();
  const [cambiandoPassword, setCambiandoPassword] = useState(false);

  return (
    <header className="flex items-center justify-between gap-4 bg-neutral-900 px-4 py-3 text-white sm:px-6">
      <div>
        <h1 className="text-lg font-semibold sm:text-xl">{titulo}</h1>
        {usuario && <p className="text-xs text-neutral-400">{usuario.nombre}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCambiandoPassword(true)}
          title="Cambiar mi contraseña"
          className="flex items-center gap-1.5 rounded-lg bg-neutral-700 px-3 py-2 text-sm font-medium active:bg-neutral-600"
        >
          <IconLock width={16} height={16} />
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-700 px-3 py-2 text-sm font-medium active:bg-neutral-600"
        >
          <IconLogout width={16} height={16} />
          Salir
        </button>
      </div>
      {cambiandoPassword && <CambiarPasswordModal onCerrar={() => setCambiandoPassword(false)} />}
    </header>
  );
}
