import { useEffect, useState, type FormEvent } from "react";
import type { Cliente } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch, ApiError } from "../../lib/api";
import { Modal } from "../../components/Modal";
import { IconInput } from "../../components/IconInput";
import { IconCheck, IconClientes, IconIdCard, IconPlus, IconUser } from "../../components/icons";
import { StatCard } from "../../components/StatCard";
import { FiltroBusqueda, TablaSeccion } from "../../components/TablaSeccion";

function formatoFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function AdminClientesPage() {
  const { token } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);

  async function cargar(q?: string) {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    const data = await apiFetch<Cliente[]>(`/clientes${params}`, token);
    setClientes(data);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const timeout = setTimeout(() => cargar(busqueda), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Clientes</h1>
        <button
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
        >
          <IconPlus width={14} height={14} />
          Registrar cliente
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
        <StatCard
          icono={IconClientes}
          acento="teal"
          label="Clientes"
          value={String(clientes.length)}
          hint="Cantidad de clientes que coinciden con la búsqueda (o el directorio completo, si no hay búsqueda)."
        />
      </div>

      <TablaSeccion
        icono={IconClientes}
        acento="teal"
        titulo="Directorio de clientes"
        descripcion="Se usa desde Caja para autocompletar nombre/carnet sin re-tipearlo cada vez."
        filtros={<FiltroBusqueda value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre o carnet…" />}
      >
        <ul className="divide-y divide-neutral-100">
          {clientes.map((cliente) => (
            <li key={cliente.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">{cliente.nombre}</p>
                <p className="text-xs text-neutral-500">Carnet: {cliente.carnet ?? "—"}</p>
              </div>
              <p className="shrink-0 text-xs text-neutral-400">Registrado {formatoFecha(cliente.creadoEn)}</p>
            </li>
          ))}
          {clientes.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-400">No hay clientes registrados todavía.</p>
          )}
        </ul>
      </TablaSeccion>

      {modalAbierto && (
        <ClienteModal
          token={token}
          onCerrar={() => setModalAbierto(false)}
          onCreado={() => cargar(busqueda)}
        />
      )}
    </div>
  );
}

export function ClienteModal({
  token,
  onCerrar,
  onCreado,
}: {
  token: string | null;
  onCerrar: () => void;
  onCreado: (cliente: Cliente) => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const carnet = String(form.get("carnet") ?? "").trim();
    try {
      const cliente = await apiFetch<Cliente>("/clientes", token, {
        method: "POST",
        body: JSON.stringify({ nombre: form.get("nombre"), carnet: carnet || undefined }),
      });
      onCreado(cliente);
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el cliente");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Registrar cliente" onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        <IconInput icon={IconUser} name="nombre" placeholder="Nombre completo" required autoFocus />
        <IconInput icon={IconIdCard} name="carnet" placeholder="Carnet (opcional)" />

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
