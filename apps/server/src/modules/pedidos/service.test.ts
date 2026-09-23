import { describe, expect, it } from "vitest";
import type { Configuracion } from "shared";
import {
  PedidoValidationError,
  asegurarMesaValida,
  asegurarNombreClienteValido,
  asegurarPedidoEditable,
  resolverEstadoInicial,
} from "./service.js";

const configBase = { mesaHabilitada: true } as Configuracion;

describe("asegurarNombreClienteValido", () => {
  it("rechaza un nombre nulo, vacío o solo espacios", () => {
    for (const nombre of [null, "", "   "]) {
      expect(() => asegurarNombreClienteValido(nombre)).toThrow(PedidoValidationError);
    }
  });

  it("acepta un nombre real", () => {
    expect(() => asegurarNombreClienteValido("Juan")).not.toThrow();
  });
});

describe("asegurarMesaValida", () => {
  it("exige mesa en consumo LOCAL cuando el negocio usa mesas", () => {
    expect(() => asegurarMesaValida(configBase, { tipoConsumo: "LOCAL", mesa: undefined })).toThrow(
      PedidoValidationError,
    );
    expect(() => asegurarMesaValida(configBase, { tipoConsumo: "LOCAL", mesa: "  " })).toThrow(PedidoValidationError);
  });

  it("acepta LOCAL con mesa", () => {
    expect(() => asegurarMesaValida(configBase, { tipoConsumo: "LOCAL", mesa: "5" })).not.toThrow();
  });

  it("no exige mesa si el negocio la tiene deshabilitada", () => {
    const sinMesas = { ...configBase, mesaHabilitada: false } as Configuracion;
    expect(() => asegurarMesaValida(sinMesas, { tipoConsumo: "LOCAL", mesa: undefined })).not.toThrow();
  });

  it("no exige mesa para llevar", () => {
    expect(() => asegurarMesaValida(configBase, { tipoConsumo: "LLEVAR", mesa: undefined })).not.toThrow();
  });
});

const modulos = (cocina: boolean, parrilla: boolean, entrega: boolean) =>
  ({ cocinaHabilitada: cocina, parrillaHabilitada: parrilla, entregaHabilitada: entrega }) as Configuracion;

describe("resolverEstadoInicial", () => {
  it("con todos los módulos apagados el pedido queda pendiente (no se cierra solo)", () => {
    const estado = resolverEstadoInicial(modulos(false, false, false), true);
    expect(estado.estado).toBe("PAGADO");
    expect(estado.entregadoEn).toBeNull();
    expect(estado.cocinaLista).toBe(true);
    expect(estado.parrillaLista).toBe(true);
  });

  it("con cocina y parrilla apagadas pero entrega habilitada nace listo para entregar", () => {
    expect(resolverEstadoInicial(modulos(false, false, true), true).estado).toBe("COMPLETADO");
  });

  it("con cocina habilitada espera a que cocina lo marque", () => {
    const estado = resolverEstadoInicial(modulos(true, false, false), false);
    expect(estado.estado).toBe("PAGADO");
    expect(estado.cocinaLista).toBe(false);
  });
});

describe("asegurarPedidoEditable", () => {
  const pendienteSinModulos = { estado: "PAGADO", cocinaLista: true, parrillaLista: true, requiereParrilla: true };

  it("permite anular un pedido pendiente cuando cocina y parrilla están apagadas (sus flags nacen en true)", () => {
    expect(() => asegurarPedidoEditable(pendienteSinModulos, modulos(false, false, false))).not.toThrow();
  });

  it("rechaza si cocina está habilitada y ya lo marcó lista", () => {
    expect(() => asegurarPedidoEditable(pendienteSinModulos, modulos(true, false, false))).toThrow(
      PedidoValidationError,
    );
  });

  it("rechaza si parrilla está habilitada, el pedido la usa y ya lo marcó lista", () => {
    expect(() => asegurarPedidoEditable(pendienteSinModulos, modulos(false, true, false))).toThrow(
      PedidoValidationError,
    );
  });

  it("rechaza un pedido que ya no está pendiente", () => {
    expect(() =>
      asegurarPedidoEditable({ ...pendienteSinModulos, estado: "ENTREGADO" }, modulos(false, false, false)),
    ).toThrow(PedidoValidationError);
  });
});
