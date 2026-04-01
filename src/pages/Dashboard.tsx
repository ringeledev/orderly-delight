import { useState, useMemo } from "react";
import { store, Order } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import NewOrderDialog from "@/components/NewOrderDialog";
import OrderDetailDialog from "@/components/OrderDetailDialog";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";

const TOTAL_TABLES = 12;

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

const Dashboard = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>(store.getOrders());
  const [newOrderTable, setNewOrderTable] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const refresh = () => setOrders([...store.getOrders()]);

  const activeOrders = useMemo(() => {
    const map: Record<number, Order> = {};
    orders
      .filter((o) => o.status !== "paid")
      .forEach((o) => {
        if (!map[o.tableNumber] || new Date(o.createdAt) > new Date(map[o.tableNumber].createdAt)) {
          map[o.tableNumber] = o;
        }
      });
    return map;
  }, [orders]);

  return (
    <div>
      <h1 className="text-2xl font-display text-primary mb-6">Mesas</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: TOTAL_TABLES }, (_, i) => i + 1).map((table) => {
          const order = activeOrders[table];
          return (
            <motion.div
              key={table}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: table * 0.03 }}
              onClick={() => (order ? setSelectedOrder(order) : setNewOrderTable(table))}
              className={`relative cursor-pointer rounded-xl border p-4 transition-all hover:scale-[1.02] ${
                order ? "bg-card border-border" : "bg-secondary/50 border-dashed border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-display text-lg text-foreground">Mesa {table}</span>
                {!order && <Plus size={16} className="text-muted-foreground" />}
              </div>
              {order ? (
                <>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusClass[order.status]}`}>
                    {statusLabel[order.status]}
                  </span>
                  <p className="text-primary font-semibold mt-3">${order.total.toFixed(2)}</p>
                  <p className="text-muted-foreground text-xs mt-1">{order.items.length} productos • {order.waiterName}</p>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">Disponible</p>
              )}
            </motion.div>
          );
        })}
      </div>

      {newOrderTable !== null && (
        <NewOrderDialog
          tableNumber={newOrderTable}
          user={user!}
          onClose={() => setNewOrderTable(null)}
          onCreated={() => {
            refresh();
            setNewOrderTable(null);
          }}
        />
      )}
      {selectedOrder && (
        <OrderDetailDialog
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={() => {
            refresh();
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
