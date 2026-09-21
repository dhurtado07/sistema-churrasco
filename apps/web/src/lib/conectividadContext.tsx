import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSocket } from "./socketContext";

interface ConectividadContextValue {
  /** false apenas se detecta que no hay forma de hablar con el servidor —
   * ya sea porque el navegador perdió la red, o porque el WebSocket se cayó
   * (wifi conectado pero sin salida a internet real, servidor caído, etc.). */
  online: boolean;
}

const ConectividadContext = createContext<ConectividadContextValue>({ online: true });

/**
 * "Modo liviano" sin conexión: no guarda nada para sincronizar después, solo
 * detecta la caída y avisa — cobrar/marcar sigue necesitando red, pero la
 * pantalla no se rompe ni queda en blanco, y en cuanto vuelve la señal el
 * WebSocket reconecta solo (Socket.IO ya reintenta con backoff) sin que
 * nadie tenga que recargar la página.
 */
export function ConectividadProvider({ children }: { children: ReactNode }) {
  const socket = useSocket();
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const marcarOnline = () => setOnline(true);
    const marcarOffline = () => setOnline(false);
    window.addEventListener("online", marcarOnline);
    window.addEventListener("offline", marcarOffline);
    return () => {
      window.removeEventListener("online", marcarOnline);
      window.removeEventListener("offline", marcarOffline);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    // Más confiable que navigator.onLine solo: si el WebSocket no puede
    // conectar (wifi sin salida real a internet, servidor caído), esto sí
    // lo detecta — navigator.onLine se queda en "true" aunque no llegue a
    // ningún lado.
    const marcarOnline = () => setOnline(true);
    const marcarOffline = () => setOnline(false);
    socket.on("connect", marcarOnline);
    socket.on("disconnect", marcarOffline);
    socket.on("connect_error", marcarOffline);
    if (socket.connected) setOnline(true);
    return () => {
      socket.off("connect", marcarOnline);
      socket.off("disconnect", marcarOffline);
      socket.off("connect_error", marcarOffline);
    };
  }, [socket]);

  return <ConectividadContext.Provider value={{ online }}>{children}</ConectividadContext.Provider>;
}

export function useConectividad(): ConectividadContextValue {
  return useContext(ConectividadContext);
}
