import { type Pedido, type DetallePedido, type DestinoImpresion } from "./db";

const PRINT_URL = import.meta.env.VITE_PRINT_MIDDLEWARE_URL ?? "http://localhost:4000";

export interface PrintResult {
  success: boolean;
  error?: string;
}

export interface ItemParaComanda {
  cantidad: number;
  nombre: string;
  notas?: string;
  destino: DestinoImpresion;
}

async function callMiddleware(path: string, body: unknown): Promise<PrintResult> {
  try {
    const res = await fetch(`${PRINT_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return { success: false, error: "No se pudo conectar con el servicio de impresión. ¿Está encendido?" };
  }
}

/**
 * Divide una lista de ítems por destino_impresion y manda una comanda a Cocina
 * (Comida / Extras Comida) y/u otra a Barra (Bebidas / Extras Bebidas).
 * Ítems "ninguno" no imprimen. No bloquea el flujo del mesero ante errores.
 */
export async function imprimirComandasDeItems(
  items: ItemParaComanda[],
  mesaNumero: number,
  lider?: string,
  mesero?: string
): Promise<PrintResult[]> {
  const porDestino: Record<"cocina" | "barra", ItemParaComanda[]> = { cocina: [], barra: [] };

  items.forEach((i) => {
    if (i.destino === "ninguno") return;
    porDestino[i.destino].push(i);
  });

  const jobs: Promise<PrintResult>[] = [];
  (["cocina", "barra"] as const).forEach((printerID) => {
    const lista = porDestino[printerID];
    if (lista.length === 0) return;
    jobs.push(
      callMiddleware("/api/print/ticket", {
        printerID,
        mesa: mesaNumero,
        lider,
        mesero,
        items: lista.map((i) => ({ cantidad: i.cantidad, nombre: i.nombre, notas: i.notas })),
      })
    );
  });

  return Promise.all(jobs);
}

/** Variante que arma los ítems a partir de un Pedido ya guardado (con join a productos). */
export async function imprimirComandas(pedido: Pedido, mesaNumero: number): Promise<PrintResult[]> {
  const detalles: DetallePedido[] = pedido.detalles_pedido ?? [];
  const items: ItemParaComanda[] = detalles.map((d) => ({
    cantidad: d.cantidad,
    nombre: d.productos?.nombre ?? d.nombre_extra ?? "Ítem",
    notas: d.notas,
    destino: d.productos?.destino_impresion ?? "cocina",
  }));
  return imprimirComandasDeItems(items, mesaNumero, pedido.cliente_nombre, pedido.profiles?.nombre);
}

/** Imprime la boleta en la impresora de Barra/Caja y dispara la apertura de la gaveta. */
export async function imprimirBoletaYAbrirGaveta(
  mesaNumero: number,
  items: { cantidad: number; nombre: string; precio: number }[],
  total: number,
  lider?: string,
  mesero?: string
): Promise<PrintResult> {
  return callMiddleware("/api/print/boleta", {
    printerID: "barra",
    mesa: mesaNumero,
    lider,
    mesero,
    items,
    total,
    abrirGaveta: true,
  });
}

export async function chequearImpresoras(): Promise<{ id: string; nombre: string; online: boolean }[]> {
  try {
    const res = await fetch(`${PRINT_URL}/api/printers/status`);
    return await res.json();
  } catch {
    return [];
  }
}
