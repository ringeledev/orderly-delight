import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { enviarTicket, abrirGaveta, chequearEstado, type PrinterConfig } from "./printers";
import { EscPosBuilder } from "./escpos";
import { getLogoBitmap } from "./logo";

const app = express();
app.use(cors());
app.use(express.json());

// ── Carga de impresoras (plug-and-play: el admin edita printers.config.json una vez) ──
const CONFIG_PATH = path.join(__dirname, "..", "printers.config.json");

function loadPrinters(): Record<string, PrinterConfig> {
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  const list = JSON.parse(raw) as PrinterConfig[];
  return Object.fromEntries(list.map((p) => [p.id, p]));
}

let PRINTERS = loadPrinters();

// ── Tipos de payload que manda el frontend ──────────────────────────────────

interface TicketItem {
  cantidad: number;
  nombre: string;
  notas?: string;
}

interface PrintTicketBody {
  printerID: string; // "cocina" | "barra"
  mesa: number;
  lider?: string;
  mesero?: string;
  items: TicketItem[];
}

interface BoletaItem {
  cantidad: number;
  nombre: string;
  precio: number;
}

interface BoletaBody {
  printerID: string;
  mesa: number;
  lider?: string;
  mesero?: string;
  items: BoletaItem[];
  total: number;
  abrirGaveta?: boolean;
}

// ── Builders de ticket ───────────────────────────────────────────────────────

function buildComanda(body: PrintTicketBody, titulo: string): Buffer {
  const b = new EscPosBuilder()
    .init()
    .align("center")
    .doubleSize(true)
    .bold(true)
    .text(titulo)
    .doubleSize(false)
    .bold(false)
    .text(new Date().toLocaleString("es-AR"))
    .line("=")
    .align("left")
    .bold(true)
    .text(`Mesa ${body.mesa}${body.lider ? " — " + body.lider : ""}`)
    .bold(false);

  if (body.mesero) b.text(`Mesero: ${body.mesero}`);
  b.line("-");

  body.items.forEach((i) => {
    b.doubleSize(true).text(`${i.cantidad}x ${i.nombre}`).doubleSize(false);
    if (i.notas) b.text(`   >> ${i.notas}`);
  });

  b.line("=").feed(3).cut(true);
  return b.build();
}

async function buildBoleta(body: BoletaBody): Promise<Buffer> {
  const b = new EscPosBuilder().init().align("center");

  const logo = await getLogoBitmap();
  if (logo) {
    b.rasterImage(logo.widthBytes, logo.heightPx, logo.data).feed(1);
  } else {
    b.bold(true).doubleSize(true).text("Sazón Latino").doubleSize(false).bold(false);
  }

  b.text(new Date().toLocaleString("es-AR")).line("-")
    .align("left")
    .text(`Mesa: ${body.mesa}`);

  if (body.lider) b.text(`Cliente: ${body.lider}`);
  if (body.mesero) b.text(`Mesero: ${body.mesero}`);
  b.line("-");

  body.items.forEach((i) =>
    b.text(`${i.cantidad}x ${i.nombre.padEnd(18).slice(0, 18)} $${(i.precio * i.cantidad).toFixed(2)}`)
  );

  b.line("-")
    .bold(true)
    .text(`TOTAL: $${body.total.toFixed(2)}`)
    .bold(false)
    .align("center")
    .feed(1)
    .text("Gracias por su visita!")
    .feed(6)
    .cut(true);

  return b.build();
}

// ── Rutas ────────────────────────────────────────────────────────────────────

app.post("/api/print/ticket", async (req, res) => {
  const body = req.body as PrintTicketBody;
  const printer = PRINTERS[body.printerID];
  if (!printer) {
    return res.status(400).json({ success: false, error: `Impresora "${body.printerID}" no configurada` });
  }
  const titulo = body.printerID === "cocina" ? "COMANDA COCINA" : "COMANDA BARRA";
  const result = await enviarTicket(printer, buildComanda(body, titulo));
  res.status(result.success ? 200 : 502).json(result);
});

app.post("/api/print/boleta", async (req, res) => {
  const body = req.body as BoletaBody;
  const printer = PRINTERS[body.printerID];
  if (!printer) {
    return res.status(400).json({ success: false, error: `Impresora "${body.printerID}" no configurada` });
  }

  const result = await enviarTicket(printer, await buildBoleta(body));

  if (result.success && body.abrirGaveta && printer.tieneGaveta) {
    await abrirGaveta(printer);
  }

  res.status(result.success ? 200 : 502).json(result);
});

app.post("/api/drawer/open", async (req, res) => {
  const { printerID } = req.body as { printerID: string };
  const printer = PRINTERS[printerID];
  if (!printer) return res.status(400).json({ success: false, error: "Impresora no configurada" });
  if (!printer.tieneGaveta) return res.status(400).json({ success: false, error: "Esta impresora no tiene gaveta asociada" });
  const result = await abrirGaveta(printer);
  res.status(result.success ? 200 : 502).json(result);
});

app.get("/api/printers/status", async (_req, res) => {
  const checks = await Promise.all(
    Object.values(PRINTERS).map(async (p) => ({
      id: p.id,
      nombre: p.nombre,
      nombreLocal: p.nombreLocal,
      online: await chequearEstado(p),
    }))
  );
  res.json(checks);
});

// Recarga config sin reiniciar el servicio (útil si el admin cambia una IP)
app.post("/api/printers/reload", (_req, res) => {
  try {
    PRINTERS = loadPrinters();
    res.json({ success: true, printers: Object.values(PRINTERS) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`🖨️  Sazón Latino — Print Middleware escuchando en http://localhost:${PORT}`);
  console.log(`Impresoras configuradas:`, Object.values(PRINTERS).map((p) => `${p.id}@${p.nombreLocal}`).join(", "));
});
