/**
 * Redimensiona y comprime una imagen en el navegador antes de subirla, para
 * que quepa cómoda en un campo de texto (data URI) sin necesitar un bucket de
 * almacenamiento externo. Ver IMAGEN_MAX_CHARS en packages/shared.
 */
export function resizeImageToDataUrl(
  file: File,
  maxDim = 480,
  quality = 0.8,
  // PNG (sin pérdida) para imágenes donde la compresión JPEG puede arruinar
  // el resultado — ej. un código QR, donde un artefacto de compresión en un
  // módulo puede hacer que deje de poder escanearse.
  mimeType: "image/jpeg" | "image/png" = "image/jpeg",
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Este navegador no soporta el redimensionado de imágenes"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(mimeType, quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
