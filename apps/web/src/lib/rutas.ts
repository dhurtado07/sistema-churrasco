/** Pantalla de trabajo de cada rol: a donde va tras el login, o al abrir la app
 * con una sesión ya válida. */
export const RUTA_POR_ROL: Record<string, string> = {
  cajero: "/caja",
  cocina: "/cocina",
  parrilla: "/parrilla",
  entrega: "/entrega",
  admin: "/admin",
  empleado: "/asistencia",
};
