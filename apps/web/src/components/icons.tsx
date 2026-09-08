import type { SVGProps } from "react";

function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconGanancias(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3 16.5V9M9.5 16.5V4.5M16 16.5V11.5" />
    </svg>
  );
}

export function IconProductos(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 5.5h12M4 10h12M4 14.5h8" />
    </svg>
  );
}

export function IconCaja(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5.5" width="14" height="10" rx="1.5" />
      <path d="M3 8.5h14M7 12h.01M10 12h3" />
    </svg>
  );
}

export function IconCocina(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M10 3c1.8 2 2.4 3.4 1.2 4.8-1 .1-1.7-.4-1.7-1.3-1 .9-1.5 2-1.5 3.1a2.9 2.9 0 1 0 5.8 0c0-2.4-1.6-4.8-3.8-6.6Z" />
      <path d="M5.5 16.5h9" />
    </svg>
  );
}

export function IconClientes(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="6.5" r="2.5" />
      <path d="M4.5 16c.6-3 2.7-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
    </svg>
  );
}

export function IconParrilla(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="6" width="14" height="8" rx="1" />
      <path d="M3 9.3h14M3 11.7h14M6.5 6v8M10 6v8M13.5 6v8" strokeWidth={1.2} />
    </svg>
  );
}

export function IconEntrega(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 8.5 10 5l6.5 3.5V14L10 17.5 3.5 14Z" />
      <path d="M3.5 8.5 10 12l6.5-3.5M10 12v5.5" />
    </svg>
  );
}

export function IconAlerta(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M10 3.5 17.5 16h-15Z" />
      <path d="M10 8.5v3.2M10 14.2h.01" />
    </svg>
  );
}

export function IconConfiguracion(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 4v1.6M10 14.4V16M16 10h-1.6M5.6 10H4M14.1 5.9l-1.1 1.1M7 12l-1.1 1.1M14.1 14.1 13 13M7 8 5.9 5.9" />
    </svg>
  );
}

export function IconPedidos(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="4.5" y="3.5" width="11" height="14" rx="1.5" />
      <path d="M7.5 3.5V5.5h5V3.5" />
      <path d="M7 9.5h6M7 12.5h6M7 15h3.5" />
    </svg>
  );
}

export function IconEdit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12.7 3.8a1.6 1.6 0 0 1 2.3 2.3L6.5 14.6l-3 .7.7-3Z" />
    </svg>
  );
}

export function IconMesa(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 7h15M4 7l1 9.5M16 7l-1 9.5" />
      <path d="M6 10.5h8" strokeWidth={1.2} />
    </svg>
  );
}

export function IconPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

export function IconMinus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 10h12" />
    </svg>
  );
}

export function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 6h12M8 6V4.5h4V6M6 6l.6 9.5A1 1 0 0 0 7.6 16.5h4.8a1 1 0 0 0 1-1L14 6" />
      <path d="M8.3 9v4.5M11.7 9v4.5" />
    </svg>
  );
}

export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </svg>
  );
}

export function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.2 13.2 17 17" />
    </svg>
  );
}

export function IconUser(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="6.5" r="2.5" />
      <path d="M4.5 16c.6-3 2.7-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
    </svg>
  );
}

export function IconLock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="4.5" y="9" width="11" height="7.5" rx="1.5" />
      <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" />
    </svg>
  );
}

export function IconIdCard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
      <circle cx="7" cy="10" r="1.6" />
      <path d="M4.8 14.2c.4-1.4 1.2-2.1 2.2-2.1s1.8.7 2.2 2.1M12 8.5h4M12 11h4M12 13.5h2.5" />
    </svg>
  );
}

export function IconTag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M10.5 3.5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-.3.7l-7.5 7.5a1 1 0 0 1-1.4 0L3 13.4a1 1 0 0 1 0-1.4l7.5-7.5a1 1 0 0 1 .7-.3ZM13.3 6.7h.01" />
    </svg>
  );
}

export function IconFolder(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3 6a1 1 0 0 1 1-1h3.5l1.5 1.8H16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z" />
    </svg>
  );
}

export function IconCoin(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.7v6.6M8 12.3c0 .9.9 1 2 1s2-.4 2-1.3c0-.8-.7-1-2-1.3-1.3-.3-2-.6-2-1.4 0-.8.9-1.2 2-1.2s2 .2 2 1" />
    </svg>
  );
}

export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 9.5 10 4l6 5.5" />
      <path d="M5.5 8.5V16h9V8.5" />
    </svg>
  );
}

export function IconBag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5.5 7h9l.7 9.5H4.8L5.5 7Z" />
      <path d="M7.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  );
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 10.5 8 14.5 16 5.5" />
    </svg>
  );
}

export function IconPrint(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M6 7.5V3.5h8v4" />
      <rect x="3.5" y="7.5" width="13" height="6.5" rx="1" />
      <path d="M6 12h8v4.5H6V12Z" />
    </svg>
  );
}

export function IconRefresh(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M16 6.5a6 6 0 1 0 1.2 5" />
      <path d="M16.5 3v4h-4" />
    </svg>
  );
}

export function IconLogout(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M8.5 3.5H5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h3.5" />
      <path d="M13 6.5 17 10l-4 3.5M17 10H8" />
    </svg>
  );
}

export function IconLogin(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M11.5 3.5H15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-3.5" />
      <path d="M7 6.5 3 10l4 3.5M3 10h9" />
    </svg>
  );
}

export function IconPower(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M10 3.5v6" />
      <path d="M6 5.8a6 6 0 1 0 8 0" />
    </svg>
  );
}

export function IconCamera(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 7a1 1 0 0 1 1-1h2l1-1.5h5L13.5 6h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1V7Z" />
      <circle cx="10" cy="10.5" r="2.6" />
    </svg>
  );
}

export function IconNegocio(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3 8.5 4 3.5h12l1 5" />
      <path d="M3 8.5a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 2 0V16.5H4V8.5Z" />
      <path d="M8 16.5V12h4v4.5" />
    </svg>
  );
}

export function IconProveedor(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 6.5h8v7h-8Z" />
      <path d="M10.5 9.5h3l2 2.3v1.7h-5Z" />
      <circle cx="6" cy="14.8" r="1.3" />
      <circle cx="13.5" cy="14.8" r="1.3" />
    </svg>
  );
}

export function IconCompra(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3 5h2l1.6 8.5h8.4L16.5 8H6.3" />
      <circle cx="8.5" cy="16" r="1.1" />
      <circle cx="14.5" cy="16" r="1.1" />
    </svg>
  );
}

export function IconInventario(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3 6.5 10 3l7 3.5-7 3.5-7-3.5Z" />
      <path d="M3 6.5V14l7 3.5 7-3.5V6.5M10 10v7.5" />
    </svg>
  );
}

export function IconEmpleado(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="6.5" r="2.5" />
      <path d="M4.5 16c.6-3 2.7-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
      <path d="M13.5 3.5h2.5v2.5M16 3.5l-2.5 2.5" />
    </svg>
  );
}

export function IconAsistencia(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10.5" r="6.5" />
      <path d="M10 6.8V11l3 1.7" />
      <path d="M7.5 2.5h5" />
    </svg>
  );
}

export function IconInfo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 9.2v4.3M10 6.7h.01" />
    </svg>
  );
}

export function IconFiltro(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 4.5h13L11.5 10v5l-3 1.5V10Z" />
    </svg>
  );
}

export function IconDescarga(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M10 3.5v9M6.5 9.5 10 13l3.5-3.5" />
      <path d="M4 16h12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Íconos de comida — respaldo visual cuando un producto/extra no tiene foto
// propia todavía (ver ImagenProducto.tsx). Elegidos por tipo de alimento para
// que la cajera reconozca de un vistazo qué es, en vez de un cuadro vacío.
// ---------------------------------------------------------------------------

export function IconComidaCarne(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M6.2 12.3c-1.7-1.7-1.7-4.5.2-6.3 2.1-2 5.3-2.3 7.5-.3 1.7 1.6 1.9 4.1.5 6-1.9 2.6-5.3 3.5-8.2 2.1Z" />
      <path d="M8.3 9.3h1.8M8.9 11.6h2.1" />
    </svg>
  );
}

export function IconComidaPollo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M8.3 4.8c2.6 0 4.7 2 4.7 4.6 0 1.9-1 3.4-2.5 4.2l-2.9 3.3a1.2 1.2 0 0 1-1.9-1.6l2.8-3c-1-.8-1.7-2.3-1.7-4 0-1.8.6-3.5 1.5-3.5Z" />
      <circle cx="13.8" cy="15.6" r="1" />
    </svg>
  );
}

export function IconComidaChorizo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4.7 13.8c-1-2.6.3-5.4 3-6.5l4.7-2c1.9-.8 3.9 1.2 3.1 3.1l-2 4.7c-1.1 2.7-4 4-6.5 3a3.8 3.8 0 0 1-2.3-2.3Z" />
      <path d="M8.4 8.4 9.9 10M11 6.8l1.5 1.5" />
    </svg>
  );
}

export function IconComidaArroz(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3.7 10.2h12.6a6.3 4.6 0 0 1-12.6 0Z" />
      <path d="M9.7 4.3c.4.6.2 1.1-.3 1.5M12.2 5c.4.6.2 1.1-.3 1.5" />
    </svg>
  );
}

export function IconComidaPapas(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5.3 9 4.5 16.2h11l-.8-7.2Z" />
      <path d="M7.2 9V5.3M9.4 9V4.5M11.6 9V5.3M13.8 9V6.1" />
    </svg>
  );
}

export function IconComidaEnsalada(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3.7 10.2h12.6a6.3 4.6 0 0 1-12.6 0Z" />
      <path d="M8 9c.2-2 1.7-3.6 3.6-3.8-.3 2-1.8 3.6-3.6 3.8Z" />
    </svg>
  );
}

export function IconComidaBebida(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M6.2 5h7.6l-1 11a1 1 0 0 1-1 .9H8.2a1 1 0 0 1-1-.9L6.2 5Z" />
      <path d="M6.6 8.2h7.2" />
      <path d="M13.3 3.3 11.3 8" />
    </svg>
  );
}

/** Plato genérico — respaldo cuando ningún tipo de comida específico calza. */
export function IconComidaPlato(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="6.3" />
      <circle cx="10" cy="10" r="2.8" />
    </svg>
  );
}
