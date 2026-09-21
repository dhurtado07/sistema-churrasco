import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Empleado, HorasTrabajadasEmpleado, TipoMarcaAsistencia } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { formatBs, formatoFechaCortaDesdeClaveBO, formatoHoraBO } from "../../lib/format";
import { diasDelPeriodo } from "../../lib/asistencia";
import { Modal } from "../../components/Modal";
import { IconInput } from "../../components/IconInput";
import {
  IconAsistencia,
  IconCheck,
  IconCoin,
  IconEdit,
  IconEmpleado,
  IconLock,
  IconPlus,
  IconTag,
  IconUser,
} from "../../components/icons";
import { StatCard } from "../../components/StatCard";
import { Badge, FilaVacia, FiltroBusqueda, FiltroChip, Paginacion, TablaSeccion, Th } from "../../components/TablaSeccion";
import { ConfirmActionModal } from "../../components/ConfirmActionModal";
import { Tabs } from "../../components/Tabs";

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
  const [tab, setTab] = useState<"directorio" | "asistencia">("directorio");
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

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "directorio", label: "Directorio" },
          { value: "asistencia", label: "Asistencia" },
        ]}
      />

      {tab === "asistencia" && <AsistenciaEmpleadoTab token={token} empleados={empleados} />}

      {tab === "directorio" && (
        <>
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
        </>
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

type PresetAsistencia = "semana" | "mes" | "mesPasado";

function rangoAsistencia(preset: PresetAsistencia): { desde: Date; hasta: Date } {
  const hasta = new Date();
  hasta.setHours(23, 59, 59, 999);
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);

  if (preset === "semana") {
    desde.setDate(desde.getDate() - 6);
    return { desde, hasta };
  }
  if (preset === "mesPasado") {
    desde.setMonth(desde.getMonth() - 1, 1);
    const finMesPasado = new Date(hasta.getFullYear(), hasta.getMonth(), 0);
    finMesPasado.setHours(23, 59, 59, 999);
    return { desde, hasta: finMesPasado };
  }
  desde.setDate(1);
  return { desde, hasta };
}

/** Formato "YYYY-MM-DDTHH:mm" en hora local, el que espera un input
 * datetime-local — a diferencia de toISOString() (que da UTC y rompe el
 * valor mostrado al usuario). */
function aInputDatetimeLocal(fecha: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
}

/** Pestaña "Asistencia" de Empleados: elegir un empleado, ver sus marcas día
 * por día en el período elegido (mismo cálculo que la vista de kiosko del
 * propio empleado) y cargar a mano una entrada/salida que no se marcó sola
 * (empleado sin cuenta propia, se olvidó de marcar, turno pasado). */
function AsistenciaEmpleadoTab({ token, empleados }: { token: string | null; empleados: Empleado[] }) {
  const [empleadoId, setEmpleadoId] = useState<string>("");
  const [preset, setPreset] = useState<PresetAsistencia>("mes");
  const [desdeManual, setDesdeManual] = useState("");
  const [hastaManual, setHastaManual] = useState("");
  const [usarRangoManual, setUsarRangoManual] = useState(false);
  const [horas, setHoras] = useState<HorasTrabajadasEmpleado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marcando, setMarcando] = useState<TipoMarcaAsistencia | null>(null);
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(15);

  useEffect(() => {
    if (!empleadoId && empleados.length > 0) {
      setEmpleadoId(empleados.find((e) => e.activo)?.id ?? empleados[0].id);
    }
  }, [empleados, empleadoId]);

  const { desde, hasta } = useMemo(() => {
    if (usarRangoManual && desdeManual && hastaManual) {
      const d = new Date(desdeManual);
      d.setHours(0, 0, 0, 0);
      const h = new Date(hastaManual);
      h.setHours(23, 59, 59, 999);
      return { desde: d, hasta: h };
    }
    return rangoAsistencia(preset);
  }, [preset, usarRangoManual, desdeManual, hastaManual]);

  async function cargarHoras() {
    if (!empleadoId) return;
    setError(null);
    try {
      const [fila] = await apiFetch<HorasTrabajadasEmpleado[]>(
        `/asistencia?empleadoId=${empleadoId}&desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`,
        token,
      );
      setHoras(fila ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las marcas");
    }
  }

  useEffect(() => {
    cargarHoras();
    setPagina(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, empleadoId, desde.getTime(), hasta.getTime()]);

  const todosLosDias = horas ? diasDelPeriodo(horas.marcas, desde, hasta) : [];
  const diasPresente = todosLosDias.filter((d) => d.presente).length;
  const totalPaginas = Math.max(1, Math.ceil(todosLosDias.length / tamano));
  const dias = todosLosDias.slice((pagina - 1) * tamano, pagina * tamano);

  const ultimaMarca = [...(horas?.marcas ?? [])].sort(
    (a, b) => new Date(b.momento).getTime() - new Date(a.momento).getTime(),
  )[0];
  const tipoSugerido: TipoMarcaAsistencia = !ultimaMarca || ultimaMarca.tipo === "SALIDA" ? "ENTRADA" : "SALIDA";

  const empleado = empleados.find((e) => e.id === empleadoId) ?? null;

  return (
    <TablaSeccion
      icono={IconAsistencia}
      acento="violeta"
      titulo="Asistencia por empleado"
      descripcion="Marcá a mano la entrada/salida de un empleado y revisá su historial día por día."
      filtros={
        <>
          <select
            value={empleadoId}
            onChange={(e) => setEmpleadoId(e.target.value)}
            className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
          >
            {empleados.length === 0 && <option value="">Sin empleados</option>}
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} · {e.puesto}
                {!e.activo ? " (inactivo)" : ""}
              </option>
            ))}
          </select>
          <FiltroChip activo={!usarRangoManual && preset === "semana"} acento="violeta" onClick={() => { setPreset("semana"); setUsarRangoManual(false); }}>
            Últimos 7 días
          </FiltroChip>
          <FiltroChip activo={!usarRangoManual && preset === "mes"} acento="violeta" onClick={() => { setPreset("mes"); setUsarRangoManual(false); }}>
            Este mes
          </FiltroChip>
          <FiltroChip activo={!usarRangoManual && preset === "mesPasado"} acento="violeta" onClick={() => { setPreset("mesPasado"); setUsarRangoManual(false); }}>
            Mes pasado
          </FiltroChip>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={desdeManual}
              onChange={(e) => { setDesdeManual(e.target.value); setUsarRangoManual(true); }}
              className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
            />
            <span className="text-xs text-neutral-400">a</span>
            <input
              type="date"
              value={hastaManual}
              onChange={(e) => { setHastaManual(e.target.value); setUsarRangoManual(true); }}
              className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
            />
          </div>
        </>
      }
      acciones={
        empleado && (
          <>
            <button
              onClick={() => setMarcando("ENTRADA")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white ${
                tipoSugerido === "ENTRADA" ? "bg-emerald-600" : "bg-emerald-600/50"
              }`}
            >
              <IconCheck width={13} height={13} />
              Marcar entrada
            </button>
            <button
              onClick={() => setMarcando("SALIDA")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white ${
                tipoSugerido === "SALIDA" ? "bg-red-600" : "bg-red-600/50"
              }`}
            >
              <IconCheck width={13} height={13} />
              Marcar salida
            </button>
          </>
        )
      }
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {empleados.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-400">Registrá un empleado primero.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <StatCard
              icono={IconAsistencia}
              acento="violeta"
              label="Horas trabajadas"
              value={`${(horas?.horas ?? 0).toFixed(1)} h`}
              hint="Suma de horas del período elegido, emparejando cada entrada con su salida."
            />
            <StatCard
              icono={IconCheck}
              acento="esmeralda"
              label="Días presente"
              value={String(diasPresente)}
              hint="Días del período con al menos una marca de entrada/salida."
            />
          </div>

          <div className="overflow-x-auto border-t border-neutral-100 pt-3">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-neutral-100">
                  <Th>Día</Th>
                  <Th>Estado</Th>
                  <Th>Marcas (entrada/salida)</Th>
                  <Th align="right">Horas</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {dias.map((d) => (
                  <tr key={d.clave}>
                    <td className="px-3 py-2 text-sm font-medium text-neutral-900">
                      {formatoFechaCortaDesdeClaveBO(d.clave)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tono={d.presente ? "verde" : "gris"}>{d.presente ? "Presente" : "Ausente"}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-500">
                      {d.marcas.length > 0
                        ? d.marcas
                            .map(
                              (m) =>
                                `${m.tipo === "ENTRADA" ? "E" : "S"} ${formatoHoraBO(m.momento)}${
                                  m.origen === "MANUAL" ? " (manual)" : ""
                                }`,
                            )
                            .join(" · ")
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-semibold text-neutral-900">
                      {d.presente ? `${d.horas.toFixed(1)} h` : "—"}
                    </td>
                  </tr>
                ))}
                {todosLosDias.length === 0 && <FilaVacia colSpan={4}>Sin días en el período elegido.</FilaVacia>}
              </tbody>
            </table>
            <Paginacion
              pagina={pagina}
              totalPaginas={totalPaginas}
              totalItems={todosLosDias.length}
              tamano={tamano}
              tamanosDisponibles={[15, 30, 60]}
              onCambiarPagina={setPagina}
              onCambiarTamano={(t) => { setTamano(t); setPagina(1); }}
            />
          </div>
        </>
      )}

      {marcando && empleado && (
        <MarcarAsistenciaModal
          token={token}
          empleado={empleado}
          tipo={marcando}
          onCerrar={() => setMarcando(null)}
          onListo={() => { setMarcando(null); cargarHoras(); }}
        />
      )}
    </TablaSeccion>
  );
}

function MarcarAsistenciaModal({
  token,
  empleado,
  tipo,
  onCerrar,
  onListo,
}: {
  token: string | null;
  empleado: Empleado;
  tipo: TipoMarcaAsistencia;
  onCerrar: () => void;
  onListo: () => void;
}) {
  const [tipoElegido, setTipoElegido] = useState<TipoMarcaAsistencia>(tipo);
  const [momento, setMomento] = useState(() => aInputDatetimeLocal(new Date()));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const notas = String(form.get("notas") ?? "").trim();
    try {
      await apiFetch(`/asistencia/${empleado.id}/marcar-manual`, token, {
        method: "POST",
        body: JSON.stringify({
          tipo: tipoElegido,
          momento: new Date(momento).toISOString(),
          notas: notas || undefined,
        }),
      });
      onListo();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar la marca");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={`Marcar asistencia — ${empleado.nombre}`} onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setTipoElegido("ENTRADA")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              tipoElegido === "ENTRADA" ? "bg-emerald-600 text-white" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            Entrada
          </button>
          <button
            type="button"
            onClick={() => setTipoElegido("SALIDA")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              tipoElegido === "SALIDA" ? "bg-red-600 text-white" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            Salida
          </button>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Fecha y hora</label>
          <input
            type="datetime-local"
            value={momento}
            onChange={(e) => setMomento(e.target.value)}
            required
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-neutral-400">Por defecto es ahora — cambiala si estás cargando un turno pasado.</p>
        </div>
        <IconInput icon={IconTag} name="notas" placeholder="Notas (opcional)" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={guardando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <IconCheck width={16} height={16} />
          {guardando ? "Guardando…" : `Registrar ${tipoElegido === "ENTRADA" ? "entrada" : "salida"}`}
        </button>
      </form>
    </Modal>
  );
}
