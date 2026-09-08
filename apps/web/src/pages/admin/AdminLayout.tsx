import { useState, type SVGProps } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { Configuracion } from "shared";
import { useAuth } from "../../lib/auth";
import { useConfiguracion } from "../../lib/configuracionContext";
import { CambiarPasswordModal } from "../../components/CambiarPasswordModal";
import {
  IconAlerta,
  IconCaja,
  IconClientes,
  IconClose,
  IconCocina,
  IconCoin,
  IconCompra,
  IconConfiguracion,
  IconEmpleado,
  IconEntrega,
  IconGanancias,
  IconInventario,
  IconDescarga,
  IconLock,
  IconLogout,
  IconParrilla,
  IconPedidos,
  IconProductos,
  IconProveedor,
  IconUser,
} from "../../components/icons";

interface NavItem {
  to: string;
  label: string;
  end: boolean;
  Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
  // Si el módulo tiene un switch en Configuración (Cocina/Parrilla/Entrega),
  // se linkea acá para poder avisar en el propio menú cuando está apagado —
  // así nadie confunde "no llegan pedidos a esta pantalla" con un error.
  configKey?: keyof Configuracion;
}

const GRUPOS: { titulo: string; items: NavItem[] }[] = [
  {
    // Todo el flujo en vivo de un pedido, de punta a punta: se hace en Pedidos/Caja,
    // pasa por Cocina y Parrilla, y termina en Entrega — antes estaba repartido entre
    // "Negocio" y "Estaciones en vivo", lo que no dejaba ver que es un solo flujo.
    titulo: "Pedidos y estaciones",
    items: [
      { to: "/admin/pedidos", label: "Pedidos", end: false, Icon: IconPedidos },
      { to: "/admin/caja", label: "Caja", end: false, Icon: IconCaja },
      { to: "/admin/cocina", label: "Cocina", end: false, Icon: IconCocina, configKey: "cocinaHabilitada" },
      { to: "/admin/parrilla", label: "Parrilla", end: false, Icon: IconParrilla, configKey: "parrillaHabilitada" },
      { to: "/admin/entrega", label: "Entrega", end: false, Icon: IconEntrega, configKey: "entregaHabilitada" },
    ],
  },
  {
    titulo: "Negocio",
    items: [
      { to: "/admin", label: "Ganancias", end: true, Icon: IconGanancias },
      { to: "/admin/reportes", label: "Reportes", end: false, Icon: IconDescarga },
      { to: "/admin/caja-diaria", label: "Caja y dinero", end: false, Icon: IconCoin },
    ],
  },
  {
    titulo: "Compras e inventario",
    items: [
      { to: "/admin/compras", label: "Compras", end: false, Icon: IconCompra },
      { to: "/admin/proveedores", label: "Proveedores", end: false, Icon: IconProveedor },
      { to: "/admin/inventario", label: "Inventario", end: false, Icon: IconInventario },
      { to: "/admin/insumos", label: "Insumos y stock", end: false, Icon: IconAlerta },
    ],
  },
  {
    titulo: "Catálogo",
    items: [
      { to: "/admin/productos", label: "Productos", end: false, Icon: IconProductos },
      { to: "/admin/clientes", label: "Clientes", end: false, Icon: IconClientes },
      { to: "/admin/configuracion", label: "Configuración", end: false, Icon: IconConfiguracion },
    ],
  },
  {
    titulo: "Personal",
    items: [
      { to: "/admin/empleados", label: "Empleados", end: false, Icon: IconEmpleado },
      { to: "/admin/usuarios", label: "Usuarios de estación", end: false, Icon: IconUser },
    ],
  },
];

const NAV = GRUPOS.flatMap((grupo) => grupo.items);

// Estas rutas ya traen su propia cabecera (son la vista real de la estación
// embebida para que el admin vea en vivo cómo van las órdenes) — en mobile
// no duplicamos la barra superior de administración encima de la suya.
const RUTAS_CON_CABECERA_PROPIA = ["/admin/caja", "/admin/cocina", "/admin/parrilla", "/admin/entrega"];

/** Pill "Desactivada" para un módulo apagado en Configuración — para que
 * quien mira el menú no confunda "no llega nada acá" con un error. */
function BadgeDesactivada() {
  return (
    <span className="ml-auto shrink-0 rounded-full bg-neutral-700 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
      Desactivada
    </span>
  );
}

export function AdminLayout() {
  const { usuario, logout } = useAuth();
  const { configuracion } = useConfiguracion();
  const location = useLocation();
  const ocultarTopbarMobile = RUTAS_CON_CABECERA_PROPIA.includes(location.pathname);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cambiandoPassword, setCambiandoPassword] = useState(false);

  const paginaActual = NAV.find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)));

  return (
    <div className="min-h-dvh bg-neutral-100 sm:flex">
      {/* Sidebar — desktop/tablet */}
      <aside className="hidden w-56 shrink-0 flex-col bg-neutral-900 text-white sm:flex">
        <div className="p-4">
          <p className="text-lg font-semibold">Administración</p>
          <p className="text-xs text-neutral-400">{usuario?.nombre}</p>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-2">
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo}>
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                {grupo.titulo}
              </p>
              <div className="space-y-1">
                {grupo.items.map(({ to, label, end, Icon, configKey }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                        isActive ? "bg-neutral-700 text-white" : "text-neutral-300 hover:bg-neutral-800"
                      }`
                    }
                  >
                    <Icon />
                    {label}
                    {configKey && !configuracion[configKey] && <BadgeDesactivada />}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="m-2 flex gap-1.5">
          <button
            onClick={() => setCambiandoPassword(true)}
            title="Cambiar mi contraseña"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-neutral-700 px-3 py-2 text-sm font-medium"
          >
            <IconLock width={16} height={16} />
          </button>
          <button onClick={logout} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-700 px-3 py-2 text-sm font-medium">
            <IconLogout width={16} height={16} />
            Salir
          </button>
        </div>
      </aside>

      {/* Topbar — mobile */}
      {!ocultarTopbarMobile && (
        <header className="flex items-center justify-between bg-neutral-900 px-4 py-3 text-white sm:hidden">
          <button
            onClick={() => setMenuAbierto(true)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 -ml-2 text-left"
          >
            <span className="flex h-8 w-8 flex-col items-center justify-center gap-1 rounded-lg bg-neutral-700">
              <span className="block h-0.5 w-4 bg-white" />
              <span className="block h-0.5 w-4 bg-white" />
              <span className="block h-0.5 w-4 bg-white" />
            </span>
            <span>
              <p className="text-sm font-semibold leading-tight">{paginaActual?.label ?? "Administración"}</p>
              <p className="text-[11px] text-neutral-400">{usuario?.nombre}</p>
            </span>
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={() => setCambiandoPassword(true)}
              title="Cambiar mi contraseña"
              className="flex items-center gap-1.5 rounded-lg bg-neutral-700 px-3 py-2 text-sm font-medium"
            >
              <IconLock width={16} height={16} />
            </button>
            <button onClick={logout} className="flex items-center gap-1.5 rounded-lg bg-neutral-700 px-3 py-2 text-sm font-medium">
              <IconLogout width={16} height={16} />
            </button>
          </div>
        </header>
      )}

      {cambiandoPassword && <CambiarPasswordModal onCerrar={() => setCambiandoPassword(false)} />}

      <main className="sm:min-w-0 sm:flex-1">
        <Outlet />
      </main>

      {/* Menú — mobile, panel desplegable con todas las secciones */}
      {menuAbierto && (
        <div className="fixed inset-0 z-50 flex sm:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAbierto(false)} />
          <div className="relative flex h-full w-72 max-w-[80vw] flex-col overflow-y-auto bg-neutral-900 text-white">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-lg font-semibold">Administración</p>
                <p className="text-xs text-neutral-400">{usuario?.nombre}</p>
              </div>
              <button onClick={() => setMenuAbierto(false)} className="rounded-full p-1.5 hover:bg-neutral-800">
                <IconClose width={18} height={18} />
              </button>
            </div>
            <nav className="flex-1 space-y-4 px-2 pb-4">
              {GRUPOS.map((grupo) => (
                <div key={grupo.titulo}>
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    {grupo.titulo}
                  </p>
                  <div className="space-y-1">
                    {grupo.items.map(({ to, label, end, Icon, configKey }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={end}
                        onClick={() => setMenuAbierto(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                            isActive ? "bg-neutral-700 text-white" : "text-neutral-300 hover:bg-neutral-800"
                          }`
                        }
                      >
                        <Icon />
                        {label}
                        {configKey && !configuracion[configKey] && <BadgeDesactivada />}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
