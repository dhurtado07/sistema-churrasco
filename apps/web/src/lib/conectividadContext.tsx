import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSocket } from "./socketContext";

// Margen antes de mostrar el aviso de "sin conexión": una reconexión normal
// del WebSocket (el wifi fluctúa un instante, el celular pasa de wifi a
// datos, la pantalla se apaga y prende) se resuelve sola en 1-3 segundos —
// Socket.IO ya reintenta con backoff corto. Sin este margen, cada uno de
// esos hipos normales prendía el aviso amarillo aunque la conexión real
// nunca se hubiera perdido de verdad.
const MARGEN_ANTES_DE_AVISAR_MS = 4000;

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
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    const cancelarAviso = () => {
      if (temporizador) {
        clearTimeout(temporizador);
        temporizador = null;
      }
    };
    const marcarOnline = () => {
      cancelarAviso();
      setOnline(true);
    };
    const marcarOffline = () => {
      cancelarAviso();
      temporizador = setTimeout(() => setOnline(false), MARGEN_ANTES_DE_AVISAR_MS);
    };
    socket.on("connect", marcarOnline);
    socket.on("disconnect", marcarOffline);
    socket.on("connect_error", marcarOffline);
    if (socket.connected) setOnline(true);
    return () => {
      cancelarAviso();
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
