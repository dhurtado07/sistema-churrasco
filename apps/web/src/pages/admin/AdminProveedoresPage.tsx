import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Proveedor } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { Modal } from "../../components/Modal";
import { IconInput } from "../../components/IconInput";
import { IconCheck, IconPlus, IconProveedor, IconTag, IconUser } from "../../components/icons";
import { Badge, FiltroBusqueda, FiltroChip, TablaSeccion } from "../../components/TablaSeccion";
import { ConfirmActionModal } from "../../components/ConfirmActionModal";

export function AdminProveedoresPage() {
  const { token } = useAuth();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"TODOS" | "ACTIVOS" | "INACTIVOS">("ACTIVOS");
  const [proveedorAConfirmar, setProveedorAConfirmar] = useState<Proveedor | null>(null);
  const [guardandoToggle, setGuardandoToggle] = useState(false);
  const [errorToggle, setErrorToggle] = useState<string | null>(null);

  async function cargar() {
    setProveedores(await apiFetch<Proveedor[]>("/proveedores", token));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function confirmarToggle() {
    if (!proveedorAConfirmar) return;
    setGuardandoToggle(true);
    setErrorToggle(null);
    try {
      await apiFetch(`/proveedores/${proveedorAConfirmar.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ activo: !proveedorAConfirmar.activo }),
      });
      setProveedorAConfirmar(null);
      cargar();
    } catch (err) {
      setErrorToggle(err instanceof ApiError ? err.message : "No se pudo cambiar el estado");
    } finally {
      setGuardandoToggle(false);
    }
  }

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return proveedores.filter((p) => {
      if (filtroEstado === "ACTIVOS" && !p.activo) return false;
      if (filtroEstado === "INACTIVOS" && p.activo) return false;
      if (!termino) return true;
      return (
        p.nombre.toLowerCase().includes(termino) ||
        (p.categoria ?? "").toLowerCase().includes(termino) ||
        (p.contacto ?? "").toLowerCase().includes(termino)
      );
    });
  }, [proveedores, busqueda, filtroEstado]);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Proveedores</h1>
        <button
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
        >
          <IconPlus width={14} height={14} />
          Nuevo proveedor
        </button>
      </div>

      <TablaSeccion
        icono={IconProveedor}
        acento="violeta"
        titulo="Directorio de proveedores"
        descripcion="A quién comprarle insumos — se usan al registrar una compra en /admin/compras."
        filtros={
          <>
            <FiltroChip activo={filtroEstado === "ACTIVOS"} acento="violeta" onClick={() => setFiltroEstado("ACTIVOS")}>
              Activos
            </FiltroChip>
            <FiltroChip activo={filtroEstado === "INACTIVOS"} acento="gris" onClick={() => setFiltroEstado("INACTIVOS")}>
              Inactivos
            </FiltroChip>
            <FiltroChip activo={filtroEstado === "TODOS"} acento="azul" onClick={() => setFiltroEstado("TODOS")}>
              Todos
            </FiltroChip>
            <FiltroBusqueda value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre, categoría o contacto…" />
          </>
        }
      >
        <ul className="divide-y divide-neutral-100">
          {filtrados.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3">
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">{p.nombre}</p>
                <p className="text-xs text-neutral-500">
                  {p.categoria ?? "Sin categoría"}
                  {(p.contacto || p.telefono) && (
                    <>
                      {" · "}
                      {p.contacto ?? "—"}
                      {p.telefono ? ` · ${p.telefono}` : ""}
                    </>
                  )}
                </p>
              </div>
              <button onClick={() => setProveedorAConfirmar(p)} className="shrink-0">
                <Badge tono={p.activo ? "verde" : "gris"} hint="Click para activar/desactivar.">
                  {p.activo ? "Activo" : "Inactivo"}
                </Badge>
              </button>
            </li>
          ))}
          {filtrados.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-400">
              {proveedores.length === 0 ? "No hay proveedores todavía." : "Ningún proveedor coincide con el filtro."}
            </p>
          )}
        </ul>
      </TablaSeccion>

      {modalAbierto && (
        <ProveedorModal token={token} onCerrar={() => setModalAbierto(false)} onCreado={() => { setModalAbierto(false); cargar(); }} />
      )}
      {proveedorAConfirmar && (
        <ConfirmActionModal
          titulo={proveedorAConfirmar.activo ? "Desactivar proveedor" : "Activar proveedor"}
          mensaje={
            proveedorAConfirmar.activo ? (
              <>
                ¿Desactivar a <strong>"{proveedorAConfirmar.nombre}"</strong>? Deja de aparecer como opción al
                registrar una compra nueva — no se borra, se puede reactivar cuando quieras.
              </>
            ) : (
              <>
                ¿Activar a <strong>"{proveedorAConfirmar.nombre}"</strong>? Vuelve a estar disponible al registrar
                una compra.
              </>
            )
          }
          textoConfirmar={proveedorAConfirmar.activo ? "Sí, desactivar" : "Sí, activar"}
          tono={proveedorAConfirmar.activo ? "red" : "green"}
          cargando={guardandoToggle}
          error={errorToggle}
          onConfirmar={confirmarToggle}
          onCancelar={() => setProveedorAConfirmar(null)}
        />
      )}
    </div>
  );
}

function ProveedorModal({ token, onCerrar, onCreado }: { token: string | null; onCerrar: () => void; onCreado: () => void }) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/proveedores", token, {
        method: "POST",
        body: JSON.stringify({
          nombre: form.get("nombre"),
          categoria: String(form.get("categoria") ?? "").trim() || undefined,
          contacto: String(form.get("contacto") ?? "").trim() || undefined,
          telefono: String(form.get("telefono") ?? "").trim() || undefined,
        }),
      });
      onCreado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el proveedor");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Nuevo proveedor" onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <IconInput icon={IconProveedor} name="nombre" placeholder="Nombre del proveedor" required autoFocus />
        <IconInput icon={IconTag} name="categoria" placeholder="Categoría (ej. carne, verduras)" />
        <IconInput icon={IconUser} name="contacto" placeholder="Persona de contacto (opcional)" />
        <IconInput icon={IconUser} name="telefono" placeholder="Teléfono (opcional)" />
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
