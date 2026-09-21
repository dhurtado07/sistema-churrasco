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

/** El menú (productos + extras activos) se pide una sola vez acá arriba y se
 * comparte — antes Caja y "Editar pedido" lo volvían a pedir por su cuenta
 * cada vez que se montaban, así que entrar a Caja (o reabrirla después de
 * pasar por otra pantalla) esperaba de nuevo esa respuesta entera (que
 * incluye la imagen de cada producto) en vez de ya tenerla lista. Se
 * actualiza solo, vía WebSocket, cuando algo cambia en Productos. */
export function MenuProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const socket = useSocket();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ productos: Producto[]; extras: Extra[] }>("/menu", token)
      .then((data) => {
        setProductos(data.productos);
        setExtras(data.extras);
      })
      .finally(() => setCargando(false));
  }, [token]);

  useEffect(() => {
    if (!socket) return;
    const onMenu = (payload: { productos: Producto[]; extras: Extra[] }) => {
      setProductos(payload.productos.filter((p) => p.activo));
      setExtras(payload.extras.filter((e) => e.activo));
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
