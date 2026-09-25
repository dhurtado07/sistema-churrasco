import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Configuracion, Rol } from "shared";
import { useAuth } from "../lib/auth";
import { useConfiguracion } from "../lib/configuracionContext";
import { RUTA_POR_ROL } from "../lib/rutas";
import { EstacionHeader } from "./EstacionHeader";

type ModuloConfigurable = Extract<keyof Configuracion, `${string}Habilitada`>;

export function ProtectedRoute({
  roles = [],
  modulo,
  soloEmpleado,
  children,
}: {
  roles?: Rol[];
  /** Si se pasa, la ruta solo se muestra cuando ese módulo está habilitado
   * en Configuración — si no, se avisa en vez de mostrar una cola vacía sin
   * explicación. El admin nunca se bloquea acá (ver rutas embebidas en App). */
  modulo?: ModuloConfigurable;
  /** Para /asistencia: en vez de exigir un rol exacto, alcanza con tener un
   * Empleado asociado — un empleado con rol "cocina" también puede marcar su
   * asistencia, no solo el que no tiene ningún rol asignado. Cuando se pasa,
   * reemplaza el chequeo de `roles` en vez de sumarse a él. */
  soloEmpleado?: boolean;
  children: ReactNode;
}) {
  const { usuario } = useAuth();
  const { configuracion, cargando } = useConfiguracion();
  const location = useLocation();

  if (!usuario) return <Navigate to="/login" replace />;
  if (soloEmpleado ? !usuario.tieneEmpleado : !roles.includes(usuario.rol)) {
    // /login rebota a una sesión válida a la pantalla de su rol. Si la que se le
    // niega es justamente esa (ej. cuenta "empleado" sin ficha de Empleado), mandarlo
    // a /login sería un bucle infinito de redirecciones: se avisa en su lugar.
    if (RUTA_POR_ROL[usuario.rol] === location.pathname) return <SinAcceso />;
    return <Navigate to="/login" replace />;
  }

  if (modulo && usuario.rol !== "admin" && !cargando && !configuracion[modulo]) {
    return <ModuloDeshabilitado />;
  }

  return <>{children}</>;
}

function SinAcceso() {
  return (
    <div className="min-h-dvh bg-neutral-100">
      <EstacionHeader titulo="Sin acceso" mostrarVerPedidos={false} />
      <div className="flex flex-col items-center gap-2 p-10 text-center">
        <p className="text-lg font-semibold text-neutral-700">Tu cuenta no tiene acceso a esta pantalla.</p>
        <p className="max-w-sm text-sm text-neutral-500">
          Pedile al administrador que revise tu usuario (por ejemplo, que tenga una ficha de empleado asociada) y
          volvé a ingresar.
        </p>
      </div>
    </div>
  );
}

function ModuloDeshabilitado() {
  return (
    <div className="min-h-dvh bg-neutral-100">
      <EstacionHeader titulo="No disponible" />
      <div className="flex flex-col items-center gap-2 p-10 text-center">
        <p className="text-lg font-semibold text-neutral-700">Este módulo no está habilitado.</p>
        <p className="max-w-sm text-sm text-neutral-500">
          El restaurante configuró el sistema para no usar esta pantalla. Hablá con el administrador si creés que
          esto es un error.
        </p>
      </div>
    </div>
  );
}
