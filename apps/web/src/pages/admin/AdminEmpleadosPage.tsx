import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Empleado } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { formatBs } from "../../lib/format";
import { Modal } from "../../components/Modal";
import { IconInput } from "../../components/IconInput";
import { IconCheck, IconCoin, IconEdit, IconEmpleado, IconLock, IconPlus, IconTag, IconUser } from "../../components/icons";
import { StatCard } from "../../components/StatCard";
import { Badge, FiltroBusqueda, FiltroChip, TablaSeccion } from "../../components/TablaSeccion";
import { ConfirmActionModal } from "../../components/ConfirmActionModal";

const ROLES_EMPLEADO: { valor: Empleado["rol"]; etiqueta: string }[] = [
  { valor: "empleado", etiqueta: "Ninguno (solo asistencia)" },
  { valor: "cajero", etiqueta: "Caja" },
  { valor: "cocina", etiqueta: "Cocina" },
  { valor: "parrilla", etiqueta: "Parrilla" },
  { valor: "entrega", etiqueta: "Entrega" },
];

const ROL_EMPLEADO_LABEL: Record<Empleado["rol"], string> = {
  empleado: "Sin acceso a estación",
  cajero: "Caja",
  cocina: "Cocina",
  parrilla: "Parrilla",
  entrega: "Entrega",
};

export function AdminEmpleadosPage() {
  const { token } = useAuth();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Empleado | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"TODOS" | "ACTIVOS" | "INACTIVOS">("ACTIVOS");
  const [empleadoAConfirmar, setEmpleadoAConfirmar] = useState<Empleado | null>(null);
  const [guardandoToggle, setGuardandoToggle] = useState(false);
  const [errorToggle, setErrorToggle] = useState<string | null>(null);

  async function cargar() {
    setEmpleados(await apiFetch<Empleado[]>("/empleados", token));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function confirmarToggle() {
    if (!empleadoAConfirmar) return;
    setGuardandoToggle(true);
    setErrorToggle(null);
    try {
      await apiFetch(`/empleados/${empleadoAConfirmar.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ activo: !empleadoAConfirmar.activo }),
      });
      setEmpleadoAConfirmar(null);
      cargar();
    } catch (err) {
      setErrorToggle(err instanceof ApiError ? err.message : "No se pudo cambiar el estado");
    } finally {
      setGuardandoToggle(false);
    }
  }

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return empleados.filter((e) => {
      if (filtroEstado === "ACTIVOS" && !e.activo) return false;
      if (filtroEstado === "INACTIVOS" && e.activo) return false;
      if (!termino) return true;
      return (
        e.nombre.toLowerCase().includes(termino) ||
        e.puesto.toLowerCase().includes(termino) ||
        e.username.toLowerCase().includes(termino)
      );
    });
  }, [empleados, busqueda, filtroEstado]);

  const nominaMensual = filtrados.filter((e) => e.activo).reduce((sum, e) => sum + e.sueldo, 0);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Empleados</h1>
        <button
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
        >
          <IconPlus width={14} height={14} />
          Nuevo empleado
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          icono={IconEmpleado}
          acento="rosa"
          label="Empleados"
          value={String(filtrados.length)}
          hint="Cantidad de empleados que coinciden con el filtro."
        />
        <StatCard
          icono={IconCoin}
          acento="esmeralda"
          label="Nómina mensual (activos)"
          value={`Bs ${formatBs(nominaMensual)}`}
          hint="Suma de sueldos mensuales de los empleados activos que coinciden con el filtro — no depende de las horas marcadas."
        />
      </div>

      <TablaSeccion
        icono={IconEmpleado}
        acento="rosa"
        titulo="Directorio de empleados"
        descripcion="Cada uno tiene su propio usuario para marcar entrada/salida en /asistencia."
        filtros={
          <>
            <FiltroChip activo={filtroEstado === "ACTIVOS"} acento="rosa" onClick={() => setFiltroEstado("ACTIVOS")}>
              Activos
            </FiltroChip>
            <FiltroChip activo={filtroEstado === "INACTIVOS"} acento="gris" onClick={() => setFiltroEstado("INACTIVOS")}>
              Inactivos
            </FiltroChip>
            <FiltroChip activo={filtroEstado === "TODOS"} acento="azul" onClick={() => setFiltroEstado("TODOS")}>
              Todos
            </FiltroChip>
            <FiltroBusqueda value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre, puesto o usuario…" />
          </>
        }
      >
        <ul className="divide-y divide-neutral-100">
          {filtrados.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3">
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">{e.nombre}</p>
                <p className="text-xs text-neutral-500">
                  {e.puesto} · usuario {e.username}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-neutral-700">Bs {formatBs(e.sueldo)}/mes</span>
                  <Badge
                    tono={e.rol === "empleado" ? "gris" : "azul"}
                    hint={
                      e.rol === "empleado"
                        ? "No tiene acceso a ninguna pantalla de trabajo — solo puede marcar asistencia."
                        : `Además de marcar asistencia, tiene acceso a la pantalla de ${ROL_EMPLEADO_LABEL[e.rol]}.`
                    }
                  >
                    {ROL_EMPLEADO_LABEL[e.rol]}
                  </Badge>
                  <Badge tono={e.tienePin ? "verde" : "gris"} hint="Si tiene PIN, se le pide además de la sesión al marcar asistencia.">
                    PIN {e.tienePin ? "Sí" : "No"}
                  </Badge>
                  <button onClick={() => setEmpleadoAConfirmar(e)}>
                    <Badge tono={e.activo ? "verde" : "gris"} hint="Click para activar/desactivar.">
                      {e.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </button>
                </div>
              </div>
              <button
                onClick={() => setEditando(e)}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
              >
                <IconEdit width={13} height={13} />
                Editar
              </button>
            </li>
          ))}
          {filtrados.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-400">
              {empleados.length === 0 ? "No hay empleados registrados todavía." : "Ningún empleado coincide con el filtro."}
            </p>
          )}
        </ul>
      </TablaSeccion>

      {modalAbierto && (
        <EmpleadoModal token={token} onCerrar={() => setModalAbierto(false)} onListo={() => { setModalAbierto(false); cargar(); }} />
      )}
      {editando && (
        <EditarEmpleadoModal
          token={token}
          empleado={editando}
          onCerrar={() => setEditando(null)}
          onListo={() => {
            setEditando(null);
            cargar();
          }}
        />
      )}
      {empleadoAConfirmar && (
        <ConfirmActionModal
          titulo={empleadoAConfirmar.activo ? "Desactivar empleado" : "Activar empleado"}
          mensaje={
            empleadoAConfirmar.activo ? (
              <>
                ¿Desactivar a <strong>"{empleadoAConfirmar.nombre}"</strong>? No va a poder marcar asistencia ni
                iniciar sesión hasta que lo reactives.
              </>
            ) : (
              <>
                ¿Activar a <strong>"{empleadoAConfirmar.nombre}"</strong>? Vuelve a poder marcar asistencia e iniciar
                sesión.
              </>
            )
          }
          textoConfirmar={empleadoAConfirmar.activo ? "Sí, desactivar" : "Sí, activar"}
          tono={empleadoAConfirmar.activo ? "red" : "green"}
          cargando={guardandoToggle}
          error={errorToggle}
          onConfirmar={confirmarToggle}
          onCancelar={() => setEmpleadoAConfirmar(null)}
        />
      )}
    </div>
  );
}

function EmpleadoModal({ token, onCerrar, onListo }: { token: string | null; onCerrar: () => void; onListo: () => void }) {
  const [rol, setRol] = useState<Empleado["rol"]>("empleado");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/empleados", token, {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
          nombre: form.get("nombre"),
          puesto: form.get("puesto"),
          sueldo: Number(form.get("sueldo")),
          telefono: String(form.get("telefono") ?? "").trim() || undefined,
          pin: String(form.get("pin") ?? "").trim() || undefined,
          rol,
        }),
      });
      onListo();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el empleado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Nuevo empleado" onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <IconInput icon={IconUser} name="nombre" placeholder="Nombre completo" required autoFocus />
        <IconInput icon={IconTag} name="puesto" placeholder="Puesto (ej. Parrillero, Mesero)" required />
        <IconInput icon={IconCoin} name="sueldo" type="number" min="0" step="0.01" placeholder="Sueldo mensual" required />
        <IconInput icon={IconUser} name="telefono" placeholder="Teléfono (opcional)" />
        <div className="border-t border-neutral-200 pt-3">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Acceso a una estación (opcional)</label>
          <p className="mb-2 text-xs text-neutral-500">
            Si trabaja también en una estación (caja, cocina, parrilla o entrega), elegí cuál — va a poder entrar ahí
            además de marcar su asistencia. Si no, dejalo en "Ninguno".
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {ROLES_EMPLEADO.map((r) => (
              <button
                key={r.valor}
                type="button"
                onClick={() => setRol(r.valor)}
                className={`rounded-lg px-2.5 py-2 text-left text-xs font-medium ${
                  rol === r.valor ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {r.etiqueta}
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-neutral-200 pt-3">
          <p className="mb-2 text-xs text-neutral-500">
            Usuario y contraseña para que marque su entrada/salida en /asistencia.
          </p>
          <IconInput icon={IconUser} name="username" placeholder="Usuario" className="mb-2" required />
          <IconInput icon={IconLock} name="password" type="password" placeholder="Contraseña (mín. 6 caracteres)" required />
        </div>
        <div className="border-t border-neutral-200 pt-3">
          <p className="mb-2 text-xs text-neutral-500">
            PIN opcional (4-6 dígitos): se le pide además de la sesión al marcar asistencia, para que nadie marque por
            él/ella compartiendo el kiosko.
          </p>
          <IconInput icon={IconLock} name="pin" inputMode="numeric" pattern="\d{4,6}" placeholder="PIN (opcional)" maxLength={6} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={guardando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <IconCheck width={16} height={16} />
          {guardando ? "Guardando…" : "Registrar"}
        </button>
      </form>
    </Modal>
  );
}

function EditarEmpleadoModal({
  token,
  empleado,
  onCerrar,
  onListo,
}: {
  token: string | null;
  empleado: Empleado;
  onCerrar: () => void;
  onListo: () => void;
}) {
  const [rol, setRol] = useState<Empleado["rol"]>(empleado.rol);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const nuevaPassword = String(form.get("password") ?? "").trim();
    const nuevoPin = String(form.get("pin") ?? "").trim();
    try {
      await apiFetch(`/empleados/${empleado.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          puesto: form.get("puesto"),
          sueldo: Number(form.get("sueldo")),
          password: nuevaPassword || undefined,
          pin: nuevoPin || undefined,
          rol,
        }),
      });
      onListo();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el empleado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={`Editar a ${empleado.nombre}`} onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <IconInput icon={IconTag} name="puesto" defaultValue={empleado.puesto} required />
        <IconInput icon={IconCoin} name="sueldo" type="number" min="0" step="0.01" defaultValue={empleado.sueldo} required />
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Acceso a una estación</label>
          <div className="grid grid-cols-2 gap-1.5">
            {ROLES_EMPLEADO.map((r) => (
              <button
                key={r.valor}
                type="button"
                onClick={() => setRol(r.valor)}
                className={`rounded-lg px-2.5 py-2 text-left text-xs font-medium ${
                  rol === r.valor ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {r.etiqueta}
              </button>
            ))}
          </div>
        </div>
        <IconInput icon={IconLock} name="password" type="password" placeholder="Nueva contraseña (opcional)" />
        <IconInput
          icon={IconLock}
          name="pin"
          inputMode="numeric"
          pattern="\d{4,6}"
          maxLength={6}
          placeholder={empleado.tienePin ? "Cambiar PIN (dejar vacío para no tocarlo)" : "Configurar PIN (opcional)"}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={guardando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <IconCheck width={16} height={16} />
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </Modal>
  );
}
