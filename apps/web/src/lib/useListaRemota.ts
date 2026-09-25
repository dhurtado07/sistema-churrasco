import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError, SesionVencidaError } from "./api";

export type EstadoCarga = "cargando" | "listo" | "error";

const REINTENTO_MS = 3000;

/**
 * Lista traída por GET con su estado de carga explícito. Mientras no llegó la
 * primera respuesta la pantalla debe decir "Cargando…" y no "No hay pedidos":
 * en cocina/parrilla eso hacía creer que no había nada que preparar. Si la
 * carga falla (sin conexión o error del servidor) reintenta sola cada pocos
 * segundos y conserva lo último que se había cargado.
 *
 * `ruta` en null no carga nada (ej. un modal cerrado). `setDatos` queda
 * expuesto para que cada pantalla aplique los eventos en vivo del socket.
 */
export function useListaRemota<T>(ruta: string | null, token: string | null) {
  const [datos, setDatos] = useState<T[]>([]);
  const [estado, setEstado] = useState<EstadoCarga>("cargando");
  const [error, setError] = useState<string | null>(null);
  const rutaRef = useRef(ruta);
  rutaRef.current = ruta;
  // Cambia con cada ruta nueva o al desmontar: una respuesta o reintento de
  // una ruta vieja (ej. otra pestaña) nunca pisa los datos actuales.
  const generacion = useRef(0);
  const reintento = useRef<number | undefined>(undefined);

  const recargar = useCallback(async () => {
    const rutaAlPedir = rutaRef.current;
    if (!rutaAlPedir) return;
    const generacionAlPedir = generacion.current;
    window.clearTimeout(reintento.current);
    try {
      const data = await apiFetch<T[]>(rutaAlPedir, token);
      if (generacion.current !== generacionAlPedir) return;
      setDatos(data);
      setEstado("listo");
      setError(null);
    } catch (err) {
      // Sesión vencida: la app ya manda al login, no tiene sentido reintentar.
      if (generacion.current !== generacionAlPedir || err instanceof SesionVencidaError) return;
      setEstado("error");
      setError(err instanceof ApiError ? err.message : null);
      reintento.current = window.setTimeout(recargar, REINTENTO_MS);
    }
  }, [token]);

  useEffect(() => {
    generacion.current += 1;
    setDatos([]);
    setEstado("cargando");
    setError(null);
    recargar();
    return () => {
      generacion.current += 1;
      window.clearTimeout(reintento.current);
    };
  }, [ruta, recargar]);

  return { datos, setDatos, estado, error, recargar };
}
