import { useState } from "react";
import { cerrarPedidoIndividual, getPedidosPorMesa, cancelarPedido, type Pedido } from "@/services/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle } from "lucide-react";
import BoletaModal, { detallesABoleta } from "@/components/BoletaModal";

const statusLabel: Record<string, string> = {
  pendiente: "Pendiente",
  en_preparacion: "En preparación",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cobrado",
};
const statusClass: Record<string, string> = {
  pendiente: "status-pending",
  en_preparacion: "status-preparing",
  listo: "status-preparing",
  entregado: "status-delivered",
  cancelado: "status-paid",
};

interface Props {
  order: Pedido;
  onClose: () => void;
  onUpdate: () => void;
}

const OrderDetailDialog = ({ order, onClose, onUpdate }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [showBoleta, setShowBoleta] = useState(false);
  const [boletaRecienCobrada, setBoletaRecienCobrada] = useState(false);
  const [confirmAnular, setConfirmAnular] = useState(false);
  const isActive = order.estado !== "cancelado" && order.estado !== "entregado";
  const detalles = order.detalles_pedido ?? [];

  const handleCobrar = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Verificar si quedan otros pedidos activos en la mesa antes de liberarla
      const otrosPedidos = await getPedidosPorMesa(order.mesa_id);
      const esElUltimo = otrosPedidos.every((p) => p.uuid === order.uuid);
      await cerrarPedidoIndividual(order.uuid, order.mesa_id, esElUltimo);
      // Mostrar la boleta antes de cerrar el diálogo (onUpdate desmonta este componente)
      setBoletaRecienCobrada(true);
      setShowBoleta(true);
    } catch (err) {
      console.error("Error al cobrar:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnular = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await cancelarPedido(order.uuid, order.mesa_id);
      setConfirmAnular(false);
      onUpdate();
      onClose();
    } catch (err) {
      console.error("Error al anular pedido:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={!showBoleta && !confirmAnular} onOpenChange={onClose}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">
              Mesa {order.mesas?.numero ?? "—"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusClass[order.estado]}`}>
              {statusLabel[order.estado]}
            </span>
            {order.profiles?.nombre && (
              <span className="text-muted-foreground text-xs">• {order.profiles.nombre}</span>
            )}
            {order.cliente_nombre && (
              <span className="text-muted-foreground text-xs font-medium">— {order.cliente_nombre}</span>
            )}
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {detalles.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin detalles cargados.</p>
            ) : (
              detalles.map((d, i) => (
                <div
                  key={d.uuid ?? i}
                  className={`flex justify-between text-sm gap-2 ${d.cobrado ? "opacity-40 line-through" : ""}`}
                >
                  <div>
                    <span className="text-foreground">
                      {d.cantidad}× {d.productos?.nombre ?? d.nombre_extra ?? "Ítem extra"}
                    </span>
                    {d.notas && (
                      <p className="text-xs text-amber-400 italic">⚠ {d.notas}</p>
                    )}
                  </div>
                  <span className="text-primary font-medium shrink-0">
                    ${(d.precio_historico * d.cantidad).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border pt-3">
            <div className="flex justify-between items-center mb-3">
              <div>
                <p className="text-muted-foreground text-xs">Total</p>
                <p className="text-xl font-display text-primary">
                  ${Number(order.total).toFixed(2)}
                </p>
              </div>
              <p className="text-muted-foreground text-xs text-right">
                {new Date(order.created_at).toLocaleString("es-AR", {
                  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>

            <div className="flex gap-2">
              {!isActive && (
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowBoleta(true)}>
                  Ver boleta
                </Button>
              )}
              {isActive && (
                <>
                  <Button variant="destructive" size="sm" onClick={() => setConfirmAnular(true)} disabled={submitting}>
                    Anular
                  </Button>
                  <Button size="sm" className="flex-1" onClick={handleCobrar} disabled={submitting}>
                    {submitting ? <Loader2 className="animate-spin" size={14} /> : "Cobrar"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {confirmAnular && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4 text-center">
            <XCircle size={36} className="mx-auto text-destructive" />
            <p className="font-display text-lg text-primary">¿Anular pedido?</p>
            <p className="text-muted-foreground text-sm">
              El pedido de{" "}
              <span className="text-foreground font-medium">
                {order.cliente_nombre ?? "este cliente"}
              </span>{" "}
              quedará registrado como <span className="text-destructive font-medium">Anulado</span> en el historial.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmAnular(false)}>
                Volver
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleAnular} disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" size={14} /> : "Sí, anular"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showBoleta && (
        <BoletaModal
          mesaNumero={order.mesas?.numero ?? 0}
          lider={order.cliente_nombre}
          mesero={order.profiles?.nombre}
          items={detallesABoleta(detalles)}
          cerrado_at={order.cerrado_at ?? undefined}
          onClose={() => {
            setShowBoleta(false);
            if (boletaRecienCobrada) onUpdate();
          }}
        />
      )}
    </>
  );
};

export default OrderDetailDialog;
