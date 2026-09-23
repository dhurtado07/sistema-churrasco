import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  config: { cocinaHabilitada: true, parrillaHabilitada: true, entregaHabilitada: true },
  findMany: vi.fn(async () => [] as unknown[]),
}));

vi.mock("../../db.js", () => ({ prisma: { pedido: { findMany: mocks.findMany } } }));
vi.mock("../configuracion/service.js", () => ({ obtenerConfiguracion: async () => mocks.config }));

import { listarCola } from "./service.js";

describe("listarCola: una estación apagada no muestra pedidos", () => {
  beforeEach(() => {
    mocks.config = { cocinaHabilitada: true, parrillaHabilitada: true, entregaHabilitada: true };
    mocks.findMany.mockClear();
  });

  it.each([
    ["cocina", "cocinaHabilitada"],
    ["parrilla", "parrillaHabilitada"],
    ["entrega", "entregaHabilitada"],
  ] as const)("%s apagada devuelve cola vacía sin consultar pedidos", async (estacion, campo) => {
    mocks.config = { ...mocks.config, [campo]: false };
    expect(await listarCola(estacion)).toEqual([]);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("con la estación habilitada sí consulta los pedidos", async () => {
    await listarCola("entrega");
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
  });
});
