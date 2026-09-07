import { useEffect, useState } from "react";
import type { ItemAuditado, Pedido, PedidoAuditoria } from "shared";
import { useAuth } from "../../lib/auth";
import { apiFetch } from "../../lib/api";
import { Modal } from "../../components/Modal";
import { IconEdit, IconTrash } from "../../components/icons";

function formatoHora(iso: string) {
  return new Date(iso).toLocaleString("es-BO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function resumenItems(items: ItemAuditado[]): string {
  if (items.length === 0) return "(sin ítems)";
  return items
    .map((i) => `${i.cantidad}x ${i.nombreProducto}${i.extras.length ? ` (${i.extras.join(", ")})` : ""}`)
    .join(", ");
}

/** Historial de ediciones/cancelaciones de un pedido — el dinero ya queda
 * trazado vía el libro de caja, esto es específicamente "qué ítems cambiaron
 * y quién lo hizo", que antes no quedaba registrado en ningún lado. */
export function HistorialPedidoModal({ pedido, onCerrar }: { pedido: Pedido; onCerrar: () => void }) {
  const { token } = useAuth();
  const [registros, setRegistros] = useState<PedidoAuditoria[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PedidoAuditoria[]>(`/pedidos/${pedido.folio}/auditoria`, token)
      .then(setRegistros)
      .catch(() => setError("No se pudo cargar el historial"));
  }, [pedido.folio, token]);

  return (
    <Modal titulo={`Historial del ticket #${pedido.folio}`} onCerrar={onCerrar}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!registros && !error && <p className="text-sm text-neutral-400">Cargando…</p>}
      {registros && registros.length === 0 && (
        <p className="text-sm text-neutral-400">Este pedido nunca se editó ni se canceló.</p>
      )}
      {registros && registros.length > 0 && (
        <ul className="max-h-96 space-y-3 overflow-y-auto">
          {registros.map((r) => (
            <li key={r.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    r.accion === "CANCELADO" ? "bg-red-100 text-red-700" : "bg-sky-100 text-sky-700"
                  }`}
                >
                  {r.accion === "CANCELADO" ? <IconTrash width={12} height={12} /> : <IconEdit width={12} height={12} />}
                  {r.accion === "CANCELADO" ? "Cancelado" : "Editado"}
                </span>
                <span className="text-xs text-neutral-400">
                  {formatoHora(r.creadoEn)} · {r.usuarioNombre}
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                <span className="font-medium text-neutral-700">Antes:</span> {resumenItems(r.itemsAntes)} — Bs{" "}
                {r.totalAntes.toFixed(2)}
              </p>
              {r.itemsDespues && (
                <p className="mt-1 text-xs text-neutral-500">
                  <span className="font-medium text-neutral-700">Después:</span> {resumenItems(r.itemsDespues)} — Bs{" "}
                  {r.totalDespues?.toFixed(2)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
