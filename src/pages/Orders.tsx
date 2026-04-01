import { useState } from "react";
import { store, Order } from "@/lib/store";
import OrderDetailDialog from "@/components/OrderDetailDialog";
import { motion } from "framer-motion";

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

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>(store.getOrders());
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Order | null>(null);

  const refresh = () => {
    setOrders([...store.getOrders()]);
    setSelected(null);
  };

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div>
      <h1 className="text-2xl font-display text-primary mb-4">Pedidos</h1>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {["all", "pending", "preparing", "delivered", "paid"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
              filter === s
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "Todos" : statusLabel[s]}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No hay pedidos</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelected(order)}
              className="flex items-center justify-between p-4 rounded-xl bg-card border border-border cursor-pointer hover:border-primary/30 transition-all"
            >
              <div>
                <p className="font-medium text-foreground">Mesa {order.tableNumber}</p>
                <p className="text-muted-foreground text-xs">
                  {order.items.length} productos • {order.waiterName} •{" "}
                  {new Date(order.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusClass[order.status]}`}>
                  {statusLabel[order.status]}
                </span>
                <span className="text-primary font-semibold">${order.total.toFixed(2)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {selected && (
        <OrderDetailDialog order={selected} onClose={() => setSelected(null)} onUpdate={refresh} />
      )}
    </div>
  );
};

export default Orders;
