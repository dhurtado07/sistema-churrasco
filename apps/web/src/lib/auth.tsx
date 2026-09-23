import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Rol } from "shared";
import { API_URL } from "./env";
import { registrarAlExpirarSesion } from "./api";

export interface SesionUsuario {
  id: string;
  username: string;
  rol: Rol;
  nombre: string;
  /** true si esta cuenta tiene un Empleado asociado — puede marcar
   * asistencia y ver sus propias horas sin importar su rol. */
  tieneEmpleado: boolean;
}

interface AuthState {
  token: string | null;
  usuario: SesionUsuario | null;
}

const STORAGE_KEY = "churrasco.auth";

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<SesionUsuario>;
  logout: () => void;
  cargando: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Lee el `exp` del JWT sin verificarlo (la verificación real la hace el
 * servidor) — solo sirve para no seguir mostrando una sesión que ya venció. */
function tokenVencido(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

const SIN_SESION: AuthState = { token: null, usuario: null };

function leerEstadoGuardado(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SIN_SESION;
    const guardado = JSON.parse(raw) as AuthState;
    // Sin conexión no se descarta: Caja tiene que poder seguir cobrando
    // offline aunque el token haya vencido; se revisa apenas vuelva la señal.
    if (guardado.token && navigator.onLine && tokenVencido(guardado.token)) {
      localStorage.removeItem(STORAGE_KEY);
      return SIN_SESION;
    }
    return guardado;
  } catch {
    return SIN_SESION;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => leerEstadoGuardado());
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Se persiste de forma síncrona (no vía useEffect) en el mismo momento en
  // que cambia el estado: un useEffect corre en un tick posterior al render,
  // y si justo en esa ventana ocurre una navegación dura (F5, un enlace que
  // recarga, etc.) el login recién hecho se pierde en silencio — el usuario
  // vuelve a /login como si nunca hubiese iniciado sesión. Escribir acá,
  // dentro del mismo cambio de estado, cierra esa ventana de carrera.
  function actualizarSesion(nuevoEstado: AuthState) {
    if (nuevoEstado.token) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevoEstado));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setState(nuevoEstado);
  }

  const login = async (username: string, password: string) => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "No se pudo iniciar sesión");
      }
      const data = await res.json();
      actualizarSesion({ token: data.token, usuario: data.usuario });
      return data.usuario as SesionUsuario;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      throw err;
    } finally {
      setCargando(false);
    }
  };

  const logout = () => actualizarSesion(SIN_SESION);

  // Un equipo que queda abierto de un día para otro tiene un token vencido:
  // sin esto seguía mostrando datos viejos (menú/turno en caché) hasta cerrar
  // sesión a mano. Se cierra sola al detectarlo, ya sea por el reloj o porque
  // el servidor respondió 401 (ver api.ts).
  useEffect(() => {
    const expirar = () => actualizarSesion(SIN_SESION);
    registrarAlExpirarSesion(expirar);
    const revisar = () => {
      if (state.token && navigator.onLine && tokenVencido(state.token)) expirar();
    };
    revisar();
    const intervalo = setInterval(revisar, 60_000);
    document.addEventListener("visibilitychange", revisar);
    window.addEventListener("focus", revisar);
    window.addEventListener("online", revisar);
    return () => {
      registrarAlExpirarSesion(null);
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", revisar);
      window.removeEventListener("focus", revisar);
      window.removeEventListener("online", revisar);
    };
  }, [state.token]);

  const value = useMemo(
    () => ({ ...state, login, logout, cargando, error }),
    [state, cargando, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
