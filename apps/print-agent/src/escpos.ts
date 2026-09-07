// Subconjunto mínimo de comandos ESC/POS — el protocolo que entienden casi
// todas las impresoras térmicas de tickets (Epson TM-T20 y compatibles,
// que es la mayoría de las económicas). Referencia: Epson ESC/POS Command
// Reference. Solo se implementan los comandos que usa `ticket.ts`.
const ESC = 0x1b;
const GS = 0x1d;

export class EscPosBuilder {
  private chunks: Buffer[] = [];

  init(): this {
    this.chunks.push(Buffer.from([ESC, 0x40])); // ESC @ — reset
    return this;
  }

  align(mode: "left" | "center" | "right"): this {
    const n = mode === "left" ? 0 : mode === "center" ? 1 : 2;
    this.chunks.push(Buffer.from([ESC, 0x61, n])); // ESC a n
    return this;
  }

  bold(on: boolean): this {
    this.chunks.push(Buffer.from([ESC, 0x45, on ? 1 : 0])); // ESC E n
    return this;
  }

  doubleSize(on: boolean): this {
    this.chunks.push(Buffer.from([GS, 0x21, on ? 0x11 : 0x00])); // GS ! n (ancho x2, alto x2)
    return this;
  }

  text(value: string): this {
    // Codepage latin1 cubre tildes/ñ en la mayoría de impresoras ESC/POS
    // configuradas con CP858/860 (default de fábrica común en Latinoamérica).
    this.chunks.push(Buffer.from(value, "latin1"));
    return this;
  }

  line(value = ""): this {
    return this.text(value).text("\n");
  }

  separator(char = "-", length = 32): this {
    return this.line(char.repeat(length));
  }

  feed(lines = 1): this {
    this.chunks.push(Buffer.from([ESC, 0x64, lines])); // ESC d n
    return this;
  }

  cut(): this {
    this.chunks.push(Buffer.from([GS, 0x56, 0x01])); // GS V 1 — corte parcial
    return this;
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }
}
