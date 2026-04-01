import { store, Order, OrderStatus } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  order: Order;
  onClose: () => void;
  onUpdate: () => void;
}

const statusFlow: OrderStatus[] = ["pending", "preparing", "delivered", "paid"];
const statusLabel: Record<string, string> = {
  pending: "Pendiente",
  preparing: "En preparación",
  delivered: "Entregado",
  paid: "Pagado",
};
const statusClass: Record<string, string> = {
  pending: "status-pending",
  preparing: "status-preparing",
  delivered: "status-delivered",
  paid: "status-paid",
};

const OrderDetailDialog = ({ order, onClose, onUpdate }: Props) => {
  const currentIdx = statusFlow.indexOf(order.status);
  const nextStatus = currentIdx < statusFlow.length - 1 ? statusFlow[currentIdx + 1] : null;

  const handleAdvance = () => {
    if (nextStatus) {
      store.updateOrderStatus(order.id, nextStatus);
      onUpdate();
    }
  };

  const handleDelete = () => {
    store.deleteOrder(order.id);
    onUpdate();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-primary">
            Mesa {order.tableNumber} — Pedido
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusClass[order.status]}`}>
            {statusLabel[order.status]}
          </span>
          <span className="text-muted-foreground text-xs">• {order.waiterName}</span>
        </div>

        {/* Status progress */}
        <div className="flex gap-1 mb-4">
          {statusFlow.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i <= currentIdx ? "bg-primary" : "bg-secondary"
              }`}
            />
          ))}
        </div>

        {/* Items */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-foreground">
                {item.quantity}× {item.product.name}
              </span>
              <span className="text-primary font-medium">
                ${(item.product.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-3 flex justify-between items-center">
          <div>
            <p className="text-muted-foreground text-xs">Total</p>
            <p className="text-xl font-display text-primary">${order.total.toFixed(2)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Eliminar
            </Button>
            {nextStatus && (
              <Button size="sm" onClick={handleAdvance}>
                → {statusLabel[nextStatus]}
              </Button>
            )}
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          Creado: {new Date(order.createdAt).toLocaleString("es-MX")}
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailDialog;
