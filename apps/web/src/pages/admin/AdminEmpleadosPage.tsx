import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Empleado } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { Modal } from "../../components/Modal";
import { IconInput } from "../../components/IconInput";
import { IconCheck, IconCoin, IconEdit, IconEmpleado, IconLock, IconPlus, IconTag, IconUser } from "../../components/icons";
import { StatCard } from "../../components/StatCard";
import { Badge, FiltroBusqueda, FiltroChip, TablaSeccion, Th, FilaVacia } from "../../components/TablaSeccion";

export function AdminEmpleadosPage() {
  const { token } = useAuth();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Empleado | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"TODOS" | "ACTIVOS" | "INACTIVOS">("ACTIVOS");

  async function cargar() {
    setEmpleados(await apiFetch<Empleado[]>("/empleados", token));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function alternarActivo(empleado: Empleado) {
    await apiFetch(`/empleados/${empleado.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ activo: !empleado.activo }),
    });
    cargar();
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
          value={`Bs ${nominaMensual.toFixed(2)}`}
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <Th hint="Nombre completo del empleado.">Empleado</Th>
                <Th hint="Rol dentro del negocio (ej. Mesero, Parrillero).">Puesto</Th>
                <Th hint="Usuario con el que marca su entrada/salida en /asistencia (independiente de las cuentas de estación).">
                  Usuario
                </Th>
                <Th align="right" hint="Sueldo mensual acordado.">Sueldo/mes</Th>
                <Th align="center" hint="Si tiene PIN configurado, se le pide además de la sesión al marcar asistencia — evita que alguien marque por otro compartiendo el kiosko.">
                  PIN
                </Th>
                <Th align="center" hint="Un empleado inactivo no puede marcar asistencia, pero su historial se conserva.">Estado</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtrados.map((e) => (
                <tr key={e.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2.5 font-medium text-neutral-900">{e.nombre}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{e.puesto}</td>
                  <td className="px-3 py-2.5 text-neutral-500">{e.username}</td>
                  <td className="px-3 py-2.5 text-right text-neutral-700">Bs {e.sueldo.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge tono={e.tienePin ? "verde" : "gris"}>{e.tienePin ? "Sí" : "No"}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button onClick={() => alternarActivo(e)}>
                      <Badge tono={e.activo ? "verde" : "gris"} hint="Click para activar/desactivar.">
                        {e.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => setEditando(e)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900"
                    >
                      <IconEdit width={13} height={13} />
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <FilaVacia colSpan={7}>
                  {empleados.length === 0 ? "No hay empleados registrados todavía." : "Ningún empleado coincide con el filtro."}
                </FilaVacia>
              )}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}

function EmpleadoModal({ token, onCerrar, onListo }: { token: string | null; onCerrar: () => void; onListo: () => void }) {
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
