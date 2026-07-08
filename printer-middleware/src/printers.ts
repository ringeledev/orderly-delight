import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { EscPosBuilder } from "./escpos";

const execAsync = promisify(exec);

export interface PrinterConfig {
  /** Identificador lógico usado en toda la app: "cocina" | "barra" */
  id: string;
  nombre: string;
  /** Nombre EXACTO de la impresora tal como aparece en Windows (Get-Printer | Select Name) */
  nombreLocal: string;
  /** true si esta impresora tiene la gaveta CD1100 conectada por RJ11 */
  tieneGaveta?: boolean;
}

export interface PrintResult {
  success: boolean;
  error?: string;
}

const RAW_PRINT_SCRIPT = path.join(__dirname, "..", "scripts", "RawPrint.ps1");

/**
 * Envía un buffer de comandos ESC/POS crudos directo al spooler de Windows
 * (WinSpool RAW), sin pasar por recursos compartidos de red. Evita por completo
 * los problemas de autenticación SMB de cuentas Microsoft / localhost.
 */
export async function enviarTicket(printer: PrinterConfig, contenido: Buffer): Promise<PrintResult> {
  const tempFile = path.join(os.tmpdir(), `ticket_${Date.now()}_${Math.random().toString(36).slice(2)}.bin`);
  try {
    await fs.writeFile(tempFile, contenido);
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${RAW_PRINT_SCRIPT}" -PrinterName "${printer.nombreLocal}" -FilePath "${tempFile}"`;
    const { stdout } = await execAsync(cmd);
    if (stdout.trim().startsWith("OK")) {
      return { success: true };
    }
    return { success: false, error: `No se pudo imprimir en "${printer.nombre}": ${stdout.trim()}` };
  } catch (err: any) {
    return {
      success: false,
      error: `No se pudo imprimir en "${printer.nombre}" (${printer.nombreLocal}). ¿Está encendida? Detalle: ${err.message}`,
    };
  } finally {
    fs.unlink(tempFile).catch(() => {});
  }
}

/** Dispara la apertura de la gaveta de dinero a través de la impresora a la que está cableada. */
export async function abrirGaveta(printer: PrinterConfig): Promise<PrintResult> {
  const cmd = new EscPosBuilder().init().cashDrawer(0).build();
  return enviarTicket(printer, cmd);
}

/** Chequeo liviano: intenta mandar un init vacío para confirmar que la impresora responde. */
export async function chequearEstado(printer: PrinterConfig): Promise<boolean> {
  const cmd = new EscPosBuilder().init().build();
  const result = await enviarTicket(printer, cmd);
  return result.success;
}
