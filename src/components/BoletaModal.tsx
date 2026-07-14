import { useState, useEffect } from "react";
import { type DetallePedido } from "@/services/db";
import { imprimirBoletaYAbrirGaveta } from "@/services/print";
import { Button } from "@/components/ui/button";
import { Printer, X, Loader2, CheckCircle2 } from "lucide-react";

interface BoletaItem {
  uuid?: string;
  nombre: string;
  cantidad: number;
  precio: number;
  notas?: string;
}

interface Props {
  mesaNumero: number;
  lider?: string;
  items: BoletaItem[];
  mesero?: string;
  cerrado_at?: string;
  onClose: () => void;
}

export function detallesABoleta(detalles: DetallePedido[], soloUuids?: string[]): BoletaItem[] {
  return detalles
    .filter((d) => !soloUuids || soloUuids.includes(d.uuid ?? ""))
    .map((d) => ({
      uuid: d.uuid,
      nombre: d.productos?.nombre ?? d.nombre_extra ?? "Ítem extra",
      cantidad: d.cantidad,
      precio: d.precio_historico,
      notas: d.notas,
    }));
}

const BoletaModal = ({ mesaNumero, lider, items, mesero, cerrado_at, onClose }: Props) => {
  const [imprimiendo, setImprimiendo] = useState(false);
  const [impresa, setImpresa] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const fecha = cerrado_at
    ? new Date(cerrado_at).toLocaleString("es-AR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : new Date().toLocaleString("es-AR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      });

  const handleImprimirBoleta = async () => {
    if (imprimiendo) return;
    setImprimiendo(true);
    setError(null);
    try {
      const result = await imprimirBoletaYAbrirGaveta(
        mesaNumero,
        items.map((i) => ({ cantidad: i.cantidad, nombre: i.nombre, precio: i.precio })),
        total,
        lider,
        mesero
      );
      if (result.success) {
        setImpresa(true);
      } else {
        setError(result.error ?? "No se pudo imprimir la boleta.");
      }
    } catch {
      setError("No se pudo conectar con el servicio de impresión.");
    } finally {
      setImprimiendo(false);
    }
  };

  // Evitar scroll del fondo mientras está abierto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-w-sm w-full bg-card border border-border rounded-lg p-6 space-y-4 shadow-lg">
        <p className="text-center text-sm text-muted-foreground -mt-1">
          ¿El cliente quiere una copia de su boleta?
        </p>

        {/* Receipt preview */}
        <div className="font-mono text-sm space-y-1 bg-white text-black rounded-lg p-4">
          <p className="text-center font-bold text-base">Sazón Latino</p>
          <p className="text-center text-xs text-gray-500">{fecha}</p>
          <hr className="border-dashed border-gray-400 my-1" />
          <p>Mesa: <strong>{mesaNumero}</strong></p>
          {lider && <p>Cliente: {lider}</p>}
          {mesero && <p className="text-xs text-gray-500">Mesero: {mesero}</p>}
          <hr className="border-dashed border-gray-400 my-1" />
          <div className="space-y-0.5">
            {items.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between">
                  <span>{item.cantidad}× {item.nombre}</span>
                  <span>€{(item.precio * item.cantidad).toFixed(2)}</span>
                </div>
                {item.notas && (
                  <p className="text-xs text-gray-400 pl-4">↳ {item.notas}</p>
                )}
              </div>
            ))}
          </div>
          <hr className="border-dashed border-gray-400 my-1" />
          <div className="flex justify-between font-bold text-base">
            <span>TOTAL</span>
            <span>€{total.toFixed(2)}</span>
          </div>
          <p className="text-center text-xs text-gray-400 pt-1">¡Gracias por su visita!</p>
        </div>

        {error && (
          <p className="text-destructive text-xs bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
        )}
        {impresa && (
          <p className="text-emerald-500 text-xs bg-emerald-500/10 rounded-lg px-3 py-2 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Boleta impresa correctamente
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button className="flex-1" onClick={handleImprimirBoleta} disabled={imprimiendo}>
            {imprimiendo ? (
              <Loader2 size={15} className="mr-1.5 animate-spin" />
            ) : (
              <Printer size={15} className="mr-1.5" />
            )}
            Imprimir boleta
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            <X size={15} className="mr-1.5" /> {impresa ? "Cerrar" : "No, gracias"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BoletaModal;
