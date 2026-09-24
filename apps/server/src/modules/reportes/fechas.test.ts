import { describe, expect, it } from "vitest";
import {
  finDelDiaBolivia,
  hoyBolivia,
  inicioDelDiaBolivia,
  primerDiaDelMes,
  sumarDias,
} from "shared";

// El servidor corre en hora de Bolivia (ver env.ts); los tests también.
process.env.TZ = "America/La_Paz";

import { claveBucket } from "./service.js";

describe("hoyBolivia: el día de Bolivia, no el de UTC", () => {
  it("a las 9 pm en Bolivia sigue siendo el mismo día (en UTC ya es el siguiente)", () => {
    const nueveDeLaNoche = new Date("2026-09-24T01:00:00Z"); // 23/09 21:00 en Bolivia
    expect(nueveDeLaNoche.toISOString().slice(0, 10)).toBe("2026-09-24"); // lo que hacía el bug
    expect(hoyBolivia(nueveDeLaNoche)).toBe("2026-09-23");
  });

  it("a las 00:30 en Bolivia ya es el día nuevo", () => {
    expect(hoyBolivia(new Date("2026-09-24T04:30:00Z"))).toBe("2026-09-24");
  });
});

describe("rangos de fechas", () => {
  it("un día completo en Bolivia va de 00:00 a 23:59:59 hora local (UTC-4)", () => {
    expect(inicioDelDiaBolivia("2026-09-23").toISOString()).toBe("2026-09-23T04:00:00.000Z");
    expect(finDelDiaBolivia("2026-09-23").toISOString()).toBe("2026-09-24T03:59:59.999Z");
  });

  it("semana y mes se calculan sobre fechas de calendario", () => {
    expect(sumarDias("2026-09-23", -6)).toBe("2026-09-17");
    expect(sumarDias("2026-03-02", -6)).toBe("2026-02-24"); // cruza de mes
    expect(primerDiaDelMes("2026-09-23")).toBe("2026-09-01");
  });
});

describe("claveBucket: los reportes por día/mes agrupan en hora de Bolivia", () => {
  it("una venta de las 9 pm cuenta en su día, no en el siguiente", () => {
    expect(claveBucket(new Date("2026-09-24T01:30:00Z"), "dia")).toBe("2026-09-23");
  });

  it("una venta del último día del mes por la noche cuenta en ese mes", () => {
    expect(claveBucket(new Date("2026-10-01T02:00:00Z"), "mes")).toBe("2026-09"); // 30/09 22:00 Bolivia
  });

  it("la semana empieza el lunes", () => {
    expect(claveBucket(new Date("2026-09-23T15:00:00Z"), "semana")).toBe("2026-09-21"); // miércoles → lunes 21
  });
});
