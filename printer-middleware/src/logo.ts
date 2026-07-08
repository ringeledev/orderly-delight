import { Jimp } from "jimp";
import path from "path";

export interface LogoBitmap {
  widthBytes: number;
  heightPx: number;
  data: Buffer;
}

const LOGO_PATH = path.join(__dirname, "..", "logo.png");
const ANCHO_PAPEL_PX = 384; // ~80mm a 203dpi. Usar 320 si el papel es de 58mm.

let cache: LogoBitmap | null = null;

/**
 * Carga printer-middleware/logo.png, lo redimensiona al ancho del papel,
 * lo convierte a blanco/negro puro (umbral) y lo empaqueta en formato
 * ESC/POS raster (1 bit por píxel, 8 píxeles por byte). Se cachea en memoria.
 */
export async function getLogoBitmap(): Promise<LogoBitmap | null> {
  if (cache) return cache;
  try {
    const img = await Jimp.read(LOGO_PATH);
    img.resize({ w: ANCHO_PAPEL_PX });
    img.greyscale();

    const w = img.bitmap.width;
    const h = img.bitmap.height;
    const widthBytes = Math.ceil(w / 8);
    const data = Buffer.alloc(widthBytes * h, 0);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4; // RGBA
        const gray = img.bitmap.data[idx];
        const negro = gray < 150; // umbral: más oscuro que esto = punto negro
        if (negro) {
          const byteIndex = y * widthBytes + (x >> 3);
          data[byteIndex] |= 0x80 >> (x % 8);
        }
      }
    }

    cache = { widthBytes, heightPx: h, data };
    return cache;
  } catch (err) {
    console.warn("No se pudo cargar logo.png para impresión (¿existe el archivo?):", (err as Error).message);
    return null;
  }
}
