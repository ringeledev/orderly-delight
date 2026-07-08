const ESC = 0x1b;
const GS = 0x1d;

/**
 * Builder de comandos ESC/POS crudos para impresoras térmicas Epson TM-T88V.
 * Cada método encola bytes; build() devuelve el Buffer final a enviar por socket.
 */
export class EscPosBuilder {
  private chunks: Buffer[] = [];

  init(): this {
    this.chunks.push(Buffer.from([ESC, 0x40])); // ESC @ — reset impresora
    return this;
  }

  align(pos: "left" | "center" | "right"): this {
    const n = pos === "left" ? 0 : pos === "center" ? 1 : 2;
    this.chunks.push(Buffer.from([ESC, 0x61, n]));
    return this;
  }

  bold(on: boolean): this {
    this.chunks.push(Buffer.from([ESC, 0x45, on ? 1 : 0]));
    return this;
  }

  doubleSize(on: boolean): this {
    this.chunks.push(Buffer.from([GS, 0x21, on ? 0x11 : 0x00]));
    return this;
  }

  text(str: string): this {
    // latin1 cubre acentos/ñ para la mayoría de impresoras Epson en LatAm (codepage CP1252/858)
    this.chunks.push(Buffer.from(str + "\n", "latin1"));
    return this;
  }

  line(char = "-", len = 32): this {
    this.chunks.push(Buffer.from(char.repeat(len) + "\n", "latin1"));
    return this;
  }

  feed(lines = 1): this {
    this.chunks.push(Buffer.from([ESC, 0x64, lines]));
    return this;
  }

  cut(partial = true): this {
    this.chunks.push(Buffer.from([GS, 0x56, partial ? 1 : 0]));
    return this;
  }

  /**
   * Abre la gaveta CD1100 conectada al puerto RJ11 de la impresora.
   * ESC p m t1 t2 — m=0 selecciona el pin 2 (cableado estándar de la mayoría de gavetas).
   */
  cashDrawer(pin: 0 | 1 = 0): this {
    this.chunks.push(Buffer.from([ESC, 0x70, pin, 0x19, 0xfa]));
    return this;
  }

  /**
   * Imprime una imagen rasterizada monocromo (logo) usando GS v 0.
   * `widthBytes` = ancho en bytes (ancho en píxeles / 8, debe ser entero).
   * `bitmap` = datos empaquetados 1bpp, fila por fila, MSB primero (negro = 1).
   */
  rasterImage(widthBytes: number, heightPx: number, bitmap: Buffer): this {
    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = heightPx & 0xff;
    const yH = (heightPx >> 8) & 0xff;
    this.chunks.push(Buffer.from([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH]));
    this.chunks.push(bitmap);
    return this;
  }

  build(): Buffer {
    return Buffer.concat(this.chunks);
  }
}
