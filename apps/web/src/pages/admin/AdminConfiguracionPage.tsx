import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { Configuracion } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { useConfiguracion } from "../../lib/configuracionContext";
import { resizeImageToDataUrl } from "../../lib/image";
import { IconInput } from "../../components/IconInput";
import {
  IconCaja,
  IconCamera,
  IconCheck,
  IconCocina,
  IconCoin,
  IconEntrega,
  IconMesa,
  IconParrilla,
  IconNegocio,
  IconHome,
  IconUser,
  IconIdCard,
} from "../../components/icons";

type ClaveModulo = "cocinaHabilitada" | "parrillaHabilitada" | "entregaHabilitada";
// Cualquier campo booleano de Configuracion que se prenda/apague con el
// mismo switch reutilizable (módulos de estación, mesa, métodos de pago).
type ClaveToggle = ClaveModulo | "mesaHabilitada" | keyof MetodosPagoHabilitados;

interface MetodosPagoHabilitados {
  pagoEfectivoHabilitado: boolean;
  pagoTarjetaHabilitado: boolean;
  pagoTransferenciaHabilitado: boolean;
  pagoQrHabilitado: boolean;
}

const METODOS_PAGO: { key: keyof MetodosPagoHabilitados; nombre: string }[] = [
  { key: "pagoEfectivoHabilitado", nombre: "Efectivo" },
  { key: "pagoTarjetaHabilitado", nombre: "Tarjeta" },
  { key: "pagoTransferenciaHabilitado", nombre: "Transferencia" },
  { key: "pagoQrHabilitado", nombre: "QR" },
];

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

/** Switch on/off reutilizado por módulos, mesa y métodos de pago. */
function ToggleSwitch({ activo, disabled, onClick }: { activo: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={activo}
      onClick={onClick}
      disabled={disabled}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        activo ? "bg-emerald-600" : "bg-neutral-300"
      }`}
    >
      {/* left-1 fijo (no dejar que el navegador calcule la posición inicial
          sola): sin un left explícito, un elemento absolute dentro de un
          botón relative puede terminar posicionado mal y quedar la bolita
          sobresaliendo fuera del riel en vez de encima. translate-x-0/-5
          la mueve desde ese punto fijo hasta el otro extremo. */}
      <span
        className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          activo ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

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
  const [guardando, setGuardando] = useState<ClaveToggle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [guardandoQr, setGuardandoQr] = useState(false);

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

  async function alternar(clave: ClaveToggle) {
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

  async function onQrSeleccionado(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setGuardandoQr(true);
    try {
      // maxDim/quality altos y PNG (sin pérdida): un QR comprimido como JPEG
      // chico puede perder nitidez en los módulos y dejar de ser escaneable.
      const dataUrl = await resizeImageToDataUrl(file, 640, 1, "image/png");
      setQrPreview(dataUrl);
      await apiFetch("/configuracion", token, { method: "PATCH", body: JSON.stringify({ qrPagoUrl: dataUrl }) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar la imagen del QR");
    } finally {
      setGuardandoQr(false);
    }
  }

  async function quitarQr() {
    setError(null);
    setGuardandoQr(true);
    try {
      await apiFetch("/configuracion", token, { method: "PATCH", body: JSON.stringify({ qrPagoUrl: null }) });
      setQrPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar el QR");
    } finally {
      setGuardandoQr(false);
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
              <ToggleSwitch activo={configuracion[key]} disabled={guardando === key} onClick={() => alternar(key)} />
            </li>
          ))}
          <li className="flex items-center gap-3 py-3">
            <IconMesa width={20} height={20} className="shrink-0 text-neutral-500" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-neutral-900">Número de mesa</p>
              <p className="text-xs text-neutral-500">
                Apagalo si tu local no maneja mesas (solo para llevar, o los meseros ya saben a quién le sirven) — Caja
                deja de pedirlo.
              </p>
            </div>
            <ToggleSwitch
              activo={configuracion.mesaHabilitada}
              disabled={guardando === "mesaHabilitada"}
              onClick={() => alternar("mesaHabilitada")}
            />
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          <IconCoin width={16} height={16} />
          Métodos de pago en Caja
        </div>
        <p className="mb-3 text-xs text-neutral-500">
          Apagá los que no aceptás todavía. Tiene que quedar al menos uno prendido.
        </p>

        <ul className="divide-y divide-neutral-100">
          {METODOS_PAGO.map(({ key, nombre }) => (
            <li key={key} className="flex items-center gap-3 py-3">
              <p className="min-w-0 flex-1 font-medium text-neutral-900">{nombre}</p>
              <ToggleSwitch activo={configuracion[key]} disabled={guardando === key} onClick={() => alternar(key)} />
            </li>
          ))}
        </ul>

        {configuracion.pagoQrHabilitado && (
          <div className="mt-4 border-t border-neutral-100 pt-4">
            <p className="mb-2 text-sm font-medium text-neutral-700">Código QR para cobrar</p>
            <p className="mb-3 text-xs text-neutral-500">
              Se muestra en pantalla completa en Caja cuando el cajero cobra con QR, para que el cliente lo escanee.
            </p>
            <div className="flex items-center gap-3">
              <label className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-neutral-400">
                {qrPreview ?? configuracion.qrPagoUrl ? (
                  <img src={qrPreview ?? configuracion.qrPagoUrl ?? ""} alt="QR de pago" className="h-full w-full object-contain" />
                ) : (
                  <IconCamera width={24} height={24} />
                )}
                <input type="file" accept="image/*" className="hidden" onChange={onQrSeleccionado} disabled={guardandoQr} />
              </label>
              <div className="text-xs text-neutral-500">
                <p>{guardandoQr ? "Guardando…" : "Tocá el cuadro para subir o reemplazar el QR."}</p>
                {(qrPreview ?? configuracion.qrPagoUrl) && (
                  <button type="button" onClick={quitarQr} disabled={guardandoQr} className="mt-1 text-red-600 disabled:opacity-50">
                    Quitar QR
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
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
