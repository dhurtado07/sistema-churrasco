import { useEffect, useState, type FormEvent } from "react";
import type { CajaTurno, MetodoPago, ResumenTurno } from "shared";
import { apiFetch, ApiError } from "../lib/api";
import { formatBs } from "../lib/format";
import { METODO_LABEL } from "../lib/metodoPago";
import { Modal } from "./Modal";
import { IconInput } from "./IconInput";
import { Campo } from "./Campo";
import { IconCheck, IconCoin, IconTag } from "./icons";

type OtroMetodo = Exclude<MetodoPago, "EFECTIVO">;

function Fila({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between ${fuerte ? "font-semibold" : ""}`}>
      <dt className={fuerte ? "" : "text-neutral-600"}>{etiqueta}</dt>
      <dd>{valor}</dd>
    </div>
  );
}

/** Compara lo contado con lo esperado — el mismo mensaje sirve mientras se
 * escribe el monto y en el resultado final del cierre. */
function mensajeDiferencia(diferencia: number, donde?: string): { texto: string; clases: string } {
  if (donde) {
    // QR / tarjeta / transferencia: se compara contra lo que se ve en la app.
    if (diferencia === 0) return { texto: `Cuadra exacto ${donde}.`, clases: "bg-emerald-50 text-emerald-800" };
    if (diferencia > 0) {
      return {
        texto: `Sobran Bs ${formatBs(diferencia)} ${donde}: tu app muestra más de lo que registró el sistema. Revisá si falta registrar una venta.`,
        clases: "bg-amber-50 text-amber-800",
      };
    }
    return {
      texto: `Faltan Bs ${formatBs(-diferencia)} ${donde}: el sistema registró más de lo que llegó a tu app. Revisá si algún pago no se recibió o se registró con otro medio.`,
      clases: "bg-red-50 text-red-800",
    };
  }
  if (diferencia === 0) return { texto: "La caja cuadra exacto.", clases: "bg-emerald-50 text-emerald-800" };
  if (diferencia > 0) {
    return {
      texto: `Sobran Bs ${formatBs(diferencia)}: hay más efectivo del que debería haber. Revisá si falta registrar una venta o un ingreso.`,
      clases: "bg-amber-50 text-amber-800",
    };
  }
  return {
    texto: `Faltan Bs ${formatBs(-diferencia)}: hay menos efectivo del que debería haber. Revisá si falta registrar un egreso o si se dio mal un vuelto.`,
    clases: "bg-red-50 text-red-800",
  };
}

/** Compartido entre Caja (el cajero cierra su propio turno desde el banner) y
 * "Caja y dinero" en el admin — mismo formulario, mismo endpoint. Primero
 * muestra lo vendido en el turno y cuánto efectivo debería haber en la caja,
 * para que el cajero cuente y anote lo que realmente hay. */
export function CerrarTurnoModal({
  token,
  turno,
  onCerrar,
  onListo,
}: {
  token: string | null;
  turno: CajaTurno;
  onCerrar: () => void;
  onListo: () => void;
}) {
  const [resumen, setResumen] = useState<ResumenTurno | null>(null);
  const [contado, setContado] = useState("");
  // Lo que el cajero ve en su app para QR/tarjeta/transferencia (opcional).
  const [otrosContados, setOtrosContados] = useState<Partial<Record<OtroMetodo, string>>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<CajaTurno | null>(null);

  useEffect(() => {
    apiFetch<ResumenTurno>(`/caja/turnos/${turno.id}/resumen`, token)
      .then(setResumen)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo calcular el resumen del turno"));
  }, [turno.id, token]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const nota = String(form.get("notaCierre") ?? "").trim();
    try {
      const cerrado = await apiFetch<CajaTurno>(`/caja/turnos/${turno.id}/cerrar`, token, {
        method: "PATCH",
        body: JSON.stringify({
          efectivoContado: Number(contado),
          otrosMetodosContados: Object.fromEntries(
            Object.entries(otrosContados)
              .filter(([, valor]) => valor !== undefined && valor !== "")
              .map(([metodo, valor]) => [metodo, Number(valor)]),
          ),
          notaCierre: nota || undefined,
        }),
      });
      setResultado(cerrado);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cerrar el turno");
    } finally {
      setGuardando(false);
    }
  }

  if (resultado) {
    const diferencia = resultado.diferencia ?? 0;
    const mensaje = mensajeDiferencia(diferencia);
    return (
      <Modal titulo="Caja cerrada" onCerrar={onListo}>
        <div className="space-y-3 text-sm">
          <dl className="space-y-1">
            <Fila etiqueta="Debería haber en la caja" valor={`Bs ${formatBs(resultado.efectivoEsperado ?? 0)}`} />
            <Fila etiqueta="Contaste" valor={`Bs ${formatBs(resultado.efectivoContado ?? 0)}`} fuerte />
          </dl>
          <p className={`rounded-lg p-3 text-sm font-medium ${mensaje.clases}`}>{mensaje.texto}</p>
          {Object.entries(resultado.conteoOtrosMetodos ?? {}).map(([metodo, c]) => (
            <div key={metodo} className="space-y-1 border-t border-neutral-200 pt-3">
              <dl className="space-y-1">
                <Fila etiqueta={`${METODO_LABEL[metodo as MetodoPago]}: debería haber entrado`} valor={`Bs ${formatBs(c.esperado)}`} />
                <Fila etiqueta="Viste en tu app" valor={`Bs ${formatBs(c.contado)}`} fuerte />
              </dl>
              <p className={`rounded-lg p-3 text-sm font-medium ${mensajeDiferencia(c.diferencia, `en ${METODO_LABEL[metodo as MetodoPago]}`).clases}`}>
                {mensajeDiferencia(c.diferencia, `en ${METODO_LABEL[metodo as MetodoPago]}`).texto}
              </p>
            </div>
          ))}
          <button
            type="button"
            onClick={onListo}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white"
          >
            <IconCheck width={16} height={16} />
            Listo
          </button>
        </div>
      </Modal>
    );
  }

  const contadoNumero = contado === "" ? null : Number(contado);
  const sinEntregar = resumen?.pedidosSinEntregar ?? 0;

  return (
    <Modal titulo="Cerrar caja" onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3 text-sm">
        {resumen ? (
          <>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Ventas del turno</p>
              <dl className="space-y-1">
                <Fila
                  etiqueta={`Total vendido (${resumen.cantidadVentas} pedido${resumen.cantidadVentas === 1 ? "" : "s"})`}
                  valor={`Bs ${formatBs(resumen.totalVendido)}`}
                  fuerte
                />
                {/* Solo se oculta cuando todo fue en efectivo: ahí repetiría el total. */}
                {resumen.ventasPorMetodo.some((v) => v.metodoPago !== "EFECTIVO") &&
                  resumen.ventasPorMetodo.map((v) => (
                  <Fila
                    key={v.metodoPago}
                    etiqueta={`   ${METODO_LABEL[v.metodoPago]} (${v.cantidad})`}
                    valor={`Bs ${formatBs(v.total)}`}
                  />
                ))}
              </dl>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Efectivo en la caja</p>
              <dl className="space-y-1">
                <Fila etiqueta="Con lo que abriste la caja" valor={`Bs ${formatBs(resumen.fondoInicial)}`} />
                <Fila etiqueta="+ Ventas cobradas en efectivo" valor={`Bs ${formatBs(resumen.ventasEfectivo)}`} />
                {resumen.otrosIngresosEfectivo !== 0 && (
                  <Fila etiqueta="+ Otros ingresos en efectivo" valor={`Bs ${formatBs(resumen.otrosIngresosEfectivo)}`} />
                )}
                <Fila etiqueta="− Egresos pagados en efectivo" valor={`Bs ${formatBs(resumen.egresosEfectivo)}`} />
              </dl>
              {resumen.totalVendido - resumen.ventasEfectivo > 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  Bs {formatBs(resumen.totalVendido - resumen.ventasEfectivo)} de lo vendido se cobró con tarjeta, QR o
                  transferencia: ese dinero no está en la caja, por eso no se suma acá.
                </p>
              )}
              <p className="mt-2 rounded-lg bg-neutral-900 p-3 text-center text-white">
                <span className="block text-xs uppercase tracking-wide text-neutral-300">Debería haber en la caja</span>
                <span className="text-2xl font-bold">Bs {formatBs(resumen.efectivoEsperado)}</span>
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Cuenta el efectivo de la caja e ingresa abajo lo que realmente hay.
              </p>
            </div>
          </>
        ) : (
          !error && <p className="text-neutral-500">Calculando resumen del turno…</p>
        )}

        <Campo etiqueta="Efectivo que contaste (Bs)">
          <IconInput
            icon={IconCoin}
            name="efectivoContado"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={contado}
            onChange={(e) => setContado(e.target.value)}
            required
            autoFocus
          />
        </Campo>
        {resumen && contadoNumero !== null && !Number.isNaN(contadoNumero) && (
          <p className={`rounded-lg p-3 text-xs font-medium ${mensajeDiferencia(Math.round((contadoNumero - resumen.efectivoEsperado) * 100) / 100).clases}`}>
            {mensajeDiferencia(Math.round((contadoNumero - resumen.efectivoEsperado) * 100) / 100).texto}
          </p>
        )}
        {resumen?.otrosMetodos.map(({ metodoPago, esperado }) => {
          const escrito = otrosContados[metodoPago] ?? "";
          const diferencia = escrito === "" ? null : Math.round((Number(escrito) - esperado) * 100) / 100;
          const mensaje = diferencia === null ? null : mensajeDiferencia(diferencia, `en ${METODO_LABEL[metodoPago]}`);
          return (
            <div key={metodoPago} className="space-y-2 rounded-lg border border-neutral-200 p-3">
              <p className="text-sm">
                Por <strong>{METODO_LABEL[metodoPago]}</strong> el sistema registró{" "}
                <strong>Bs {formatBs(esperado)}</strong>. Abrí tu app y anota cuánto ves (opcional).
              </p>
              <Campo etiqueta={`Lo que ves en tu app de ${METODO_LABEL[metodoPago]} (Bs)`}>
                <IconInput
                  icon={IconCoin}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={escrito}
                  onChange={(e) => setOtrosContados((prev) => ({ ...prev, [metodoPago]: e.target.value }))}
                />
              </Campo>
              {mensaje && <p className={`rounded-lg p-3 text-xs font-medium ${mensaje.clases}`}>{mensaje.texto}</p>}
            </div>
          );
        })}
        <Campo etiqueta="Nota (opcional)">
          <IconInput icon={IconTag} name="notaCierre" placeholder="Ej. faltó cambio, sobró propina" />
        </Campo>
        {sinEntregar > 0 && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Al cerrar, {sinEntregar === 1 ? "1 pedido de este turno que sigue pendiente se marcará" : `${sinEntregar} pedidos de este turno que siguen pendientes se marcarán`}{" "}
            como entregado{sinEntregar === 1 ? "" : "s"}. Los pedidos anulados no se tocan.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={guardando || !resumen}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <IconCheck width={16} height={16} />
          {guardando ? "Cerrando…" : "Confirmar cierre"}
        </button>
      </form>
    </Modal>
  );
}
