import { useEffect, useState, type FormEvent } from "react";
import type { Configuracion } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { useConfiguracion } from "../../lib/configuracionContext";
import { IconInput } from "../../components/IconInput";
import {
  IconCaja,
  IconCheck,
  IconCocina,
  IconEntrega,
  IconParrilla,
  IconNegocio,
  IconHome,
  IconUser,
  IconIdCard,
} from "../../components/icons";

type ClaveModulo = "cocinaHabilitada" | "parrillaHabilitada" | "entregaHabilitada";

const MODULOS: {
  key: ClaveModulo;
  nombre: string;
  Icon: typeof IconCocina;
  descripcion: string;
}[] = [
  {
    key: "cocinaHabilitada",
    nombre: "Cocina",
    Icon: IconCocina,
    descripcion: "Pantalla donde cocina prepara y marca los platos listos.",
  },
  {
    key: "parrillaHabilitada",
    nombre: "Parrilla",
    Icon: IconParrilla,
    descripcion: "Pantalla donde el parrillero prepara y marca la carne lista.",
  },
  {
    key: "entregaHabilitada",
    nombre: "Entrega",
    Icon: IconEntrega,
    descripcion: "Pantalla para confirmar que el pedido ya se le entregó al cliente.",
  },
];

function describirFlujo(config: Configuracion): string {
  const pasos = ["Caja"];
  if (config.cocinaHabilitada) pasos.push("Cocina");
  if (config.parrillaHabilitada) pasos.push("Parrilla");
  if (config.entregaHabilitada) pasos.push("Entrega");
  if (pasos.length === 1) {
    return "Caja → pedido queda cobrado y cerrado de una — sin cocina, parrilla ni entrega digital. Los meseros se encargan de todo.";
  }
  const ultimo = pasos[pasos.length - 1];
  return (
    pasos.join(" → ") +
    (ultimo === "Entrega"
      ? " → listo, entregado."
      : ` → en cuanto ${ultimo.toLowerCase()} marca "listo", el pedido queda cerrado de una (no hay entrega digital habilitada).`)
  );
}

export function AdminConfiguracionPage() {
  const { token } = useAuth();
  const { configuracion, cargando } = useConfiguracion();
  const [guardando, setGuardando] = useState<ClaveModulo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [negocio, setNegocio] = useState({
    nombreNegocio: configuracion.nombreNegocio,
    direccion: configuracion.direccion ?? "",
    telefono: configuracion.telefono ?? "",
    nit: configuracion.nit ?? "",
  });
  const [guardandoNegocio, setGuardandoNegocio] = useState(false);
  const [negocioGuardado, setNegocioGuardado] = useState(false);

  // `configuracion` llega async (fetch al backend) — cuando esta página se
  // monta directamente (F5, o es la primera pantalla que carga), el estado
  // local del formulario nace vacío antes de que la respuesta llegue. Una
  // vez termina de cargar, sincronizamos el formulario con los datos reales.
  useEffect(() => {
    if (cargando) return;
    setNegocio({
      nombreNegocio: configuracion.nombreNegocio,
      direccion: configuracion.direccion ?? "",
      telefono: configuracion.telefono ?? "",
      nit: configuracion.nit ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando]);

  async function alternar(clave: ClaveModulo) {
    setGuardando(clave);
    setError(null);
    try {
      await apiFetch("/configuracion", token, {
        method: "PATCH",
        body: JSON.stringify({ [clave]: !configuracion[clave] }),
      });
      // El cambio llega solo por WebSocket (configuracion:actualizada) a
      // todas las pantallas conectadas, incluida esta.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la configuración");
    } finally {
      setGuardando(null);
    }
  }

  async function guardarNegocio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardandoNegocio(true);
    setNegocioGuardado(false);
    setError(null);
    try {
      await apiFetch("/configuracion", token, {
        method: "PATCH",
        body: JSON.stringify({
          nombreNegocio: negocio.nombreNegocio,
          direccion: negocio.direccion || null,
          telefono: negocio.telefono || null,
          nit: negocio.nit || null,
        }),
      });
      setNegocioGuardado(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar los datos del negocio");
    } finally {
      setGuardandoNegocio(false);
    }
  }

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <h1 className="text-lg font-semibold text-neutral-900">Configuración</h1>
      <p className="text-sm text-neutral-500">
        No todos los restaurantes trabajan igual — habilitá solo los módulos que realmente usás. El módulo
        habilitado más "al final" de la cadena es el que cierra el pedido.
      </p>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          <IconNegocio width={16} height={16} />
          Datos del negocio
        </div>
        <p className="mb-3 text-xs text-neutral-500">
          Aparecen en el ticket impreso, en el ticket digital, en el login y en el menú público.
        </p>
        <form onSubmit={guardarNegocio} className="space-y-2.5">
          <IconInput
            icon={IconNegocio}
            placeholder="Nombre del negocio"
            value={negocio.nombreNegocio}
            onChange={(e) => setNegocio({ ...negocio, nombreNegocio: e.target.value })}
            required
          />
          <IconInput
            icon={IconHome}
            placeholder="Dirección"
            value={negocio.direccion}
            onChange={(e) => setNegocio({ ...negocio, direccion: e.target.value })}
          />
          <IconInput
            icon={IconUser}
            placeholder="Teléfono"
            value={negocio.telefono}
            onChange={(e) => setNegocio({ ...negocio, telefono: e.target.value })}
          />
          <IconInput
            icon={IconIdCard}
            placeholder="NIT / RUC"
            value={negocio.nit}
            onChange={(e) => setNegocio({ ...negocio, nit: e.target.value })}
          />
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={guardandoNegocio}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {guardandoNegocio ? "Guardando..." : "Guardar datos del negocio"}
            </button>
            {negocioGuardado && <span className="text-sm text-emerald-600">Guardado ✓</span>}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          <IconCaja width={16} height={16} />
          Caja — siempre activa
        </div>

        <ul className="divide-y divide-neutral-100">
          {MODULOS.map(({ key, nombre, Icon, descripcion }) => (
            <li key={key} className="flex items-center gap-3 py-3">
              <Icon width={20} height={20} className="shrink-0 text-neutral-500" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-neutral-900">{nombre}</p>
                <p className="text-xs text-neutral-500">{descripcion}</p>
              </div>
              <button
                role="switch"
                aria-checked={configuracion[key]}
                onClick={() => alternar(key)}
                disabled={guardando === key}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                  configuracion[key] ? "bg-emerald-600" : "bg-neutral-300"
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    configuracion[key] ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-2xl bg-neutral-900 p-4 text-white shadow-sm">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          <IconCheck width={14} height={14} />
          Con esta configuración, el flujo queda así
        </p>
        <p className="text-sm text-neutral-100">{describirFlujo(configuracion)}</p>
      </section>
    </div>
  );
}
