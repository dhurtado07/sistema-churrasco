import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { Configuracion, Rol } from "shared";
import { useAuth } from "../lib/auth";
import { useConfiguracion } from "../lib/configuracionContext";
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

  if (!usuario) return <Navigate to="/login" replace />;
  if (soloEmpleado ? !usuario.tieneEmpleado : !roles.includes(usuario.rol)) {
    return <Navigate to="/login" replace />;
  }

  if (modulo && usuario.rol !== "admin" && !cargando && !configuracion[modulo]) {
    return <ModuloDeshabilitado />;
  }

  return <>{children}</>;
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
