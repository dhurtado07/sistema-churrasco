import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { IconAsistencia, IconLock, IconLogout } from "./icons";
import { CambiarPasswordModal } from "./CambiarPasswordModal";
import { VerPedidosModal } from "./VerPedidosModal";

export function EstacionHeader({
  titulo,
  mostrarVerPedidos = true,
}: {
  titulo: string;
  /** El kiosko de asistencia no vende ni prepara pedidos — ahí se oculta,
   * sin importar el rol de la cuenta (ver soloEmpleado en App.tsx). */
  mostrarVerPedidos?: boolean;
}) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [cambiandoPassword, setCambiandoPassword] = useState(false);

  return (
    <header className="flex items-center justify-between gap-4 bg-neutral-900 px-4 py-3 text-white sm:px-6">
      <div>
        <h1 className="text-lg font-semibold sm:text-xl">{titulo}</h1>
        {usuario && <p className="text-xs text-neutral-400">{usuario.nombre}</p>}
      </div>
      <div className="flex items-center gap-2">
        {mostrarVerPedidos && <VerPedidosModal />}
        {/* Un empleado con rol de estación (cocina, caja, etc.) igual tiene
            que poder marcar su entrada/salida sin salir de su pantalla de
            trabajo — este botón lo manda a /asistencia. No sale si ya está
            ahí (sería un link a la misma página) ni en cuentas sin Empleado
            asociado (cuentas de estación compartidas, admin, impresora). */}
        {usuario?.tieneEmpleado && location.pathname !== "/asistencia" && (
          <button
            onClick={() => navigate("/asistencia")}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-700 px-3 py-2 text-sm font-medium active:bg-neutral-600"
          >
            <IconAsistencia width={16} height={16} />
            Mi asistencia
          </button>
        )}
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
