import { describe, expect, it } from "vitest";
import { conImagenPublica, decodificarDataUri, urlImagenPublica } from "./urls.js";

const foto = `data:image/jpeg;base64,${Buffer.from("foto-churrasco").toString("base64")}`;
const otraFoto = `data:image/jpeg;base64,${Buffer.from("foto-nueva").toString("base64")}`;

describe("urlImagenPublica: las fotos viajan como enlace, no como data URI", () => {
  it("una foto guardada como data URI se convierte en un enlace corto con versión", () => {
    const url = urlImagenPublica("productos", "p1", foto);
    expect(url).toMatch(/^\/imagenes\/productos\/p1\?v=[0-9a-f]{12}$/);
  });

  it("cambiar la foto cambia la URL, para que la caché del navegador no muestre la vieja", () => {
    expect(urlImagenPublica("productos", "p1", foto)).not.toBe(urlImagenPublica("productos", "p1", otraFoto));
    expect(urlImagenPublica("productos", "p1", foto)).toBe(urlImagenPublica("productos", "p1", foto));
  });

  it("sin foto sigue sin foto, y una URL http se deja tal cual", () => {
    expect(urlImagenPublica("extras", "e1", null)).toBeNull();
    expect(urlImagenPublica("extras", "e1", "https://ejemplo.com/a.jpg")).toBe("https://ejemplo.com/a.jpg");
  });

  it("conImagenPublica no toca el resto de los campos", () => {
    const producto = { id: "p1", nombre: "Churrasco", precio: 45, imagenUrl: foto };
    expect(conImagenPublica("productos", producto)).toEqual({
      ...producto,
      imagenUrl: urlImagenPublica("productos", "p1", foto),
    });
  });
});

describe("decodificarDataUri", () => {
  it("devuelve el tipo y los bytes originales de la imagen", () => {
    const imagen = decodificarDataUri(foto);
    expect(imagen?.contentType).toBe("image/jpeg");
    expect(imagen?.contenido.toString()).toBe("foto-churrasco");
  });

  it("rechaza lo que no sea una imagen en base64 (ej. SVG o HTML)", () => {
    expect(decodificarDataUri("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
    expect(decodificarDataUri("data:text/html;base64,PGgxPg==")).toBeNull();
    expect(decodificarDataUri("https://ejemplo.com/a.jpg")).toBeNull();
  });
});
