import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Configuracion } from "shared";
import { SOCKET_EVENTS } from "shared";
import { useAuth } from "./auth";
import { apiFetch } from "./api";
import { useSocket } from "./socketContext";

const DEFAULT: Configuracion = {
  cocinaHabilitada: true,
  parrillaHabilitada: true,
  entregaHabilitada: true,
  nombreNegocio: "BRASA ARISP",
  direccion: null,
  telefono: null,
  nit: null,
  logoUrl: null,
};

interface ConfiguracionContextValue {
  configuracion: Configuracion;
  cargando: boolean;
}

const ConfiguracionContext = createContext<ConfiguracionContextValue>({ configuracion: DEFAULT, cargando: true });

export function ConfiguracionProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const socket = useSocket();
  const [configuracion, setConfiguracion] = useState<Configuracion>(DEFAULT);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch<Configuracion>("/configuracion", token)
      .then(setConfiguracion)
      .finally(() => setCargando(false));
  }, [token]);

  useEffect(() => {
    if (!socket) return;
    socket.on(SOCKET_EVENTS.CONFIGURACION_ACTUALIZADA, setConfiguracion);
    return () => {
      socket.off(SOCKET_EVENTS.CONFIGURACION_ACTUALIZADA, setConfiguracion);
    };
  }, [socket]);

  return (
    <ConfiguracionContext.Provider value={{ configuracion, cargando }}>{children}</ConfiguracionContext.Provider>
  );
}

export function useConfiguracion(): ConfiguracionContextValue {
  return useContext(ConfiguracionContext);
}
