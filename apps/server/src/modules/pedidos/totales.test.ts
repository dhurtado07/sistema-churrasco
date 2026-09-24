import { describe, expect, it } from "vitest";
import { aCentavos, totalLinea } from "shared";

const arroz = { precio: 8, cantidad: 1 };

describe("totalLinea: el extra se cobra una vez, como se muestra", () => {
  it("2 platos + 1 porción de arroz cobra 1 arroz, no 2", () => {
    expect(totalLinea(37, 2, [arroz])).toBe(82); // 74 + 8 (antes cobraba 90)
  });

  it("cada extra usa SU cantidad de porciones", () => {
    expect(totalLinea(37, 1, [{ precio: 8, cantidad: 2 }])).toBe(53);
    expect(totalLinea(37, 3, [{ precio: 8, cantidad: 2 }])).toBe(127); // 111 + 16
  });

  it("sin extras es plato por cantidad", () => {
    expect(totalLinea(45, 3, [])).toBe(135);
  });

  it("no arrastra ruido de decimales", () => {
    expect(totalLinea(0.1, 3, [{ precio: 0.2, cantidad: 1 }])).toBe(0.5);
    expect(aCentavos(0.1 + 0.2)).toBe(0.3);
  });
});
