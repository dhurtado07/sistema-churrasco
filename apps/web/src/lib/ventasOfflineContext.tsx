import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { CrearPedidoInput, Pedido } from "shared";
import { useAuth } from "./auth";
import { useConectividad } from "./conectividadContext";
import { apiFetch, ApiError } from "./api";
import {
  encolarVentaOffline,
  leerColaOffline,
  marcarErrorEnColaOffline,
  quitarDeColaOffline,
  type VentaOfflineEncolada,
} from "./pedidosOfflineQueue";

interface VentasOfflineContextValue {
  pendientes: VentaOfflineEncolada[];
  sincronizando: boolean;
  /** Guarda la venta localmente (Caja ya la mostró como cobrada) y la deja
   * lista para mandarse sola apenas vuelva la conexión. */
  encolarVenta: (body: CrearPedidoInput, turnoId: string, total: number) => VentaOfflineEncolada;
  sincronizarAhora: () => void;
  /** Solo para una venta que ya quedó marcada con error (ver
   * errorSincronizacion): la saca de la cola sin mandarla — para cuando un
   * admin ya la revisó y la resolvió a mano (o decidió que no corresponde
   * insistir). Una venta sin error todavía nunca se descarta así. */
  descartarVenta: (id: string) => void;
}

const VentasOfflineContext = createContext<VentasOfflineContextValue | null>(null);

/** "Modo offline" de Caja: cobrar sin conexión guarda la venta en el propio
 * navegador (no en el servidor, que es inalcanzable) y la muestra como
 * pagada de una — el negocio no puede parar de vender porque se cortó el
 * wifi. Apenas vuelve la conexión (o al entrar a Caja si ya había algo
 * pendiente de una sesión anterior), esta cola se manda sola al servidor, en
 * el mismo orden en que se cobraron, una por una. */
export function VentasOfflineProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const { online } = useConectividad();
  const [pendientes, setPendientes] = useState<VentaOfflineEncolada[]>(() => leerColaOffline());
  const [sincronizando, setSincronizando] = useState(false);
  // Evita dos sincronizaciones corriendo a la vez (ej. "online" se dispara
  // de vuelta mientras la anterior todavía está mandando la última venta).
  const corriendoRef = useRef(false);

  const sincronizar = useCallback(async () => {
    if (corriendoRef.current || !token) return;
    corriendoRef.current = true;
    setSincronizando(true);
    try {
      // Se lee de localStorage (no del estado de React) porque esta función
      // sigue corriendo sola en el tiempo y el estado de un cierre viejo
      // podría estar desactualizado. Es una foto del momento: si se encola
      // una venta nueva mientras esto corre, la agarra la próxima pasada
      // (no puede pasar en la práctica — encolar requiere estar offline, y
      // esto solo corre cuando se detecta que se volvió a estar online).
      for (const venta of leerColaOffline()) {
        try {
          await apiFetch<Pedido>("/pedidos", token, { method: "POST", body: JSON.stringify(venta.body) });
          quitarDeColaOffline(venta.id);
          setPendientes(leerColaOffline());
        } catch (err) {
          if (err instanceof ApiError) {
            // El servidor respondió pero rechazó la venta (ej. el turno de
            // esa venta ya no existe, o un producto se borró mientras tanto)
            // — no es un problema de red, reintentar solo no va a arreglarlo.
            // Queda marcada para que un admin la revise a mano; se sigue
            // con las demás en vez de trabar toda la cola por esta.
            marcarErrorEnColaOffline(venta.id, err.message);
            setPendientes(leerColaOffline());
            continue;
          }
          // Error de red genuino (se volvió a cortar a mitad de sincronizar)
          // — se corta acá, el resto de la cola espera al próximo intento.
          break;
        }
      }
    } finally {
      corriendoRef.current = false;
      setSincronizando(false);
    }
  }, [token]);

  useEffect(() => {
    if (online && token) void sincronizar();
  }, [online, token, sincronizar]);

  function encolarVenta(body: CrearPedidoInput, turnoId: string, total: number): VentaOfflineEncolada {
    const entrada = encolarVentaOffline(body, turnoId, total);
    setPendientes(leerColaOffline());
    return entrada;
  }

  function descartarVenta(id: string) {
    quitarDeColaOffline(id);
    setPendientes(leerColaOffline());
  }

  return (
    <VentasOfflineContext.Provider
      value={{ pendientes, sincronizando, encolarVenta, sincronizarAhora: sincronizar, descartarVenta }}
    >
      {children}
    </VentasOfflineContext.Provider>
  );
}

export function useVentasOffline(): VentasOfflineContextValue {
  const ctx = useContext(VentasOfflineContext);
  if (!ctx) throw new Error("useVentasOffline debe usarse dentro de VentasOfflineProvider");
  return ctx;
}
