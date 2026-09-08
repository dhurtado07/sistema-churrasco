import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Rol } from "shared";
import { API_URL } from "./env";

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

function leerEstadoGuardado(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, usuario: null };
    return JSON.parse(raw) as AuthState;
  } catch {
    return { token: null, usuario: null };
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

  const logout = () => actualizarSesion({ token: null, usuario: null });

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
