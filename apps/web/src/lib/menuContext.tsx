import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Extra, Producto } from "shared";
import { SOCKET_EVENTS } from "shared";
import { useAuth } from "./auth";
import { apiFetch } from "./api";
import { useSocket } from "./socketContext";

interface MenuContextValue {
  productos: Producto[];
  extras: Extra[];
  cargando: boolean;
}

const MenuContext = createContext<MenuContextValue>({ productos: [], extras: [], cargando: true });

const CLAVE_CACHE = "churrasco.menuCache";

function leerMenuCacheado(): { productos: Producto[]; extras: Extra[] } | null {
  try {
    const crudo = localStorage.getItem(CLAVE_CACHE);
    return crudo ? (JSON.parse(crudo) as { productos: Producto[]; extras: Extra[] }) : null;
  } catch {
    return null;
  }
}

function guardarMenuCache(data: { productos: Producto[]; extras: Extra[] }) {
  try {
    localStorage.setItem(CLAVE_CACHE, JSON.stringify(data));
  } catch {
    // localStorage lleno/bloqueado — sin cache no hay menú offline, pero no
    // bloquea el uso normal con conexión.
  }
}

/** El menú (productos + extras activos) se pide una sola vez acá arriba y se
 * comparte — antes Caja y "Editar pedido" lo volvían a pedir por su cuenta
 * cada vez que se montaban, así que entrar a Caja (o reabrirla después de
 * pasar por otra pantalla) esperaba de nuevo esa respuesta entera (que
 * incluye la imagen de cada producto) en vez de ya tenerla lista. Se
 * actualiza solo, vía WebSocket, cuando algo cambia en Productos. */
export function MenuProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const socket = useSocket();
  // Se arranca ya con lo último que se guardó (si hay algo) para que, sin
  // conexión, Caja pueda mostrar el menú y sus precios de una — en vez de
  // quedar en blanco hasta que el pedido de red (que va a fallar) termine.
  const cacheInicial = leerMenuCacheado();
  const [productos, setProductos] = useState<Producto[]>(cacheInicial?.productos ?? []);
  const [extras, setExtras] = useState<Extra[]>(cacheInicial?.extras ?? []);
  const [cargando, setCargando] = useState(!cacheInicial);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ productos: Producto[]; extras: Extra[] }>("/menu", token)
      .then((data) => {
        setProductos(data.productos);
        setExtras(data.extras);
        guardarMenuCache(data);
      })
      .catch(() => {
        // Sin conexión (u otro error de red) — nos quedamos con lo que ya
        // había (del cache o de la sesión anterior), no lo vaciamos.
      })
      .finally(() => setCargando(false));
  }, [token]);

  useEffect(() => {
    if (!socket) return;
    const onMenu = (payload: { productos: Producto[]; extras: Extra[] }) => {
      const activos = { productos: payload.productos.filter((p) => p.activo), extras: payload.extras.filter((e) => e.activo) };
      setProductos(activos.productos);
      setExtras(activos.extras);
      guardarMenuCache(activos);
    };
    socket.on(SOCKET_EVENTS.MENU_ACTUALIZADO, onMenu);
    return () => {
      socket.off(SOCKET_EVENTS.MENU_ACTUALIZADO, onMenu);
    };
  }, [socket]);

  return <MenuContext.Provider value={{ productos, extras, cargando }}>{children}</MenuContext.Provider>;
}

export function useMenu(): MenuContextValue {
  return useContext(MenuContext);
}
