import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { RolEstacion, UsuarioEstacion } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { Modal } from "../../components/Modal";
import { IconInput } from "../../components/IconInput";
import { IconCheck, IconLock, IconPlus, IconTag, IconUser } from "../../components/icons";
import { Badge, FiltroBusqueda, FiltroChip, TablaSeccion, Th, FilaVacia } from "../../components/TablaSeccion";

const ROLES: { valor: RolEstacion; etiqueta: string; descripcion: string }[] = [
  { valor: "cajero", etiqueta: "Cajero", descripcion: "Toma y cobra pedidos en /caja." },
  { valor: "cocina", etiqueta: "Cocina", descripcion: "Ve la cola de cocina y marca platos listos." },
  { valor: "parrilla", etiqueta: "Parrilla", descripcion: "Ve la cola de parrilla y marca la carne lista." },
  { valor: "entrega", etiqueta: "Entrega", descripcion: "Confirma la entrega de pedidos ya listos." },
  { valor: "admin", etiqueta: "Administrador", descripcion: "Acceso completo al panel de administración." },
  { valor: "impresora", etiqueta: "Impresora", descripcion: "Cuenta técnica que usa apps/print-agent — no tiene pantalla propia." },
];

const ROL_LABEL: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.valor, r.etiqueta]));

function formatoFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function AdminUsuariosPage() {
  const { token, usuario: yo } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioEstacion[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<UsuarioEstacion | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"TODOS" | "ACTIVOS" | "INACTIVOS">("TODOS");
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setUsuarios(await apiFetch<UsuarioEstacion[]>("/usuarios", token));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function alternarActivo(u: UsuarioEstacion) {
    setError(null);
    try {
      await apiFetch(`/usuarios/${u.id}`, token, { method: "PATCH", body: JSON.stringify({ activo: !u.activo }) });
      cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar el estado");
    }
  }

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (filtroEstado === "ACTIVOS" && !u.activo) return false;
      if (filtroEstado === "INACTIVOS" && u.activo) return false;
      if (!termino) return true;
      return (
        u.nombre.toLowerCase().includes(termino) ||
        u.username.toLowerCase().includes(termino) ||
        (ROL_LABEL[u.rol] ?? u.rol).toLowerCase().includes(termino)
      );
    });
  }, [usuarios, busqueda, filtroEstado]);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Usuarios de estación</h1>
          <p className="text-xs text-neutral-500">
            Las cuentas de <code>/caja</code>, <code>/cocina</code>, <code>/parrilla</code>, <code>/entrega</code> y
            admin — una por estación (modo kiosko), no por persona. Para empleados individuales, ver
            "Empleados".
          </p>
        </div>
        <button
          onClick={() => setModalAbierto(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
        >
          <IconPlus width={14} height={14} />
          Nueva cuenta
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <TablaSeccion
        icono={IconUser}
        acento="indigo"
        titulo="Cuentas de estación"
        descripcion="Crear, renombrar, cambiar contraseña o desactivar cada cuenta de estación."
        filtros={
          <>
            <FiltroChip activo={filtroEstado === "TODOS"} acento="indigo" onClick={() => setFiltroEstado("TODOS")}>
              Todos
            </FiltroChip>
            <FiltroChip activo={filtroEstado === "ACTIVOS"} acento="esmeralda" onClick={() => setFiltroEstado("ACTIVOS")}>
              Activos
            </FiltroChip>
            <FiltroChip activo={filtroEstado === "INACTIVOS"} acento="gris" onClick={() => setFiltroEstado("INACTIVOS")}>
              Inactivos
            </FiltroChip>
            <FiltroBusqueda value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre, usuario o rol…" />
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <Th hint="Nombre visible de la cuenta (aparece en tickets y pantallas).">Nombre</Th>
                <Th hint="Usuario con el que se inicia sesión.">Usuario</Th>
                <Th hint="Qué pantalla puede usar esta cuenta — se valida en el servidor, no solo ocultando botones.">Rol</Th>
                <Th hint="Cuándo se creó esta cuenta.">Creada</Th>
                <Th align="center" hint="Una cuenta inactiva no puede iniciar sesión, pero su historial (pedidos cobrados, movimientos) se conserva.">
                  Estado
                </Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtrados.map((u) => (
                <tr key={u.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2.5 font-medium text-neutral-900">
                    {u.nombre}
                    {u.id === yo?.id && <span className="ml-1.5 text-xs font-normal text-neutral-400">(vos)</span>}
                  </td>
                  <td className="px-3 py-2.5 text-neutral-500">{u.username}</td>
                  <td className="px-3 py-2.5">
                    <Badge tono="azul">{ROL_LABEL[u.rol] ?? u.rol}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-500">{formatoFecha(u.creadoEn)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <button onClick={() => alternarActivo(u)}>
                      <Badge tono={u.activo ? "verde" : "gris"} hint="Click para activar/desactivar.">
                        {u.activo ? "Activa" : "Inactiva"}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => setEditando(u)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900"
                    >
                      <IconLock width={13} height={13} />
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <FilaVacia colSpan={6}>
                  {usuarios.length === 0 ? "No hay cuentas de estación todavía." : "Ninguna cuenta coincide con el filtro."}
                </FilaVacia>
              )}
            </tbody>
          </table>
        </div>
      </TablaSeccion>

      {modalAbierto && (
        <NuevaCuentaModal token={token} onCerrar={() => setModalAbierto(false)} onCreada={() => { setModalAbierto(false); cargar(); }} />
      )}
      {editando && (
        <EditarCuentaModal
          token={token}
          usuario={editando}
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

function NuevaCuentaModal({
  token,
  onCerrar,
  onCreada,
}: {
  token: string | null;
  onCerrar: () => void;
  onCreada: () => void;
}) {
  const [rol, setRol] = useState<RolEstacion>("cajero");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/usuarios", token, {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
          nombre: form.get("nombre"),
          rol,
        }),
      });
      onCreada();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la cuenta");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Nueva cuenta de estación" onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Rol / estación</label>
          <div className="grid grid-cols-2 gap-1.5">
            {ROLES.map((r) => (
              <button
                key={r.valor}
                type="button"
                onClick={() => setRol(r.valor)}
                title={r.descripcion}
                className={`rounded-lg px-2.5 py-2 text-left text-xs font-medium ${
                  rol === r.valor ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {r.etiqueta}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-neutral-400">{ROLES.find((r) => r.valor === rol)?.descripcion}</p>
        </div>
        <IconInput icon={IconTag} name="nombre" placeholder="Nombre visible (ej. Caja Principal)" required autoFocus />
        <IconInput icon={IconUser} name="username" placeholder="Usuario (mín. 3 caracteres)" required minLength={3} />
        <IconInput icon={IconLock} name="password" type="password" placeholder="Contraseña (mín. 6 caracteres)" required minLength={6} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={guardando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <IconCheck width={16} height={16} />
          {guardando ? "Creando…" : "Crear cuenta"}
        </button>
      </form>
    </Modal>
  );
}

function EditarCuentaModal({
  token,
  usuario,
  onCerrar,
  onListo,
}: {
  token: string | null;
  usuario: UsuarioEstacion;
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
    try {
      await apiFetch(`/usuarios/${usuario.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          nombre: form.get("nombre"),
          password: nuevaPassword || undefined,
        }),
      });
      onListo();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar la cuenta");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={`Editar "${usuario.nombre}"`} onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-xs text-neutral-500">
          Usuario: <span className="font-medium text-neutral-700">{usuario.username}</span> · Rol:{" "}
          <span className="font-medium text-neutral-700">{ROL_LABEL[usuario.rol] ?? usuario.rol}</span> (el usuario y el
          rol no se pueden cambiar — creá una cuenta nueva si hace falta otro rol).
        </p>
        <IconInput icon={IconTag} name="nombre" defaultValue={usuario.nombre} required />
        <IconInput icon={IconLock} name="password" type="password" placeholder="Nueva contraseña (opcional)" minLength={6} />
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
