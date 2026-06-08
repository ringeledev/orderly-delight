import { useState, useEffect, useMemo } from "react";
// CORRECCIÓN: Asegúrate que el archivo sea supabase.ts
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import NewOrderDialog from "@/components/NewOrderDialog";
import OrderDetailDialog from "@/components/OrderDetailDialog";
import { Plus, Loader2 } from "lucide-react";
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
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrderTable, setNewOrderTable] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const fetchOrders = async () => {
    setLoading(true);

    // PRUEBA DE FUEGO: Vamos a ver si los productos salen en la consola (F12)
    const { data: productos, error: prodError } = await supabase
      .from("productos")
      .select("*");
    console.log("🔥 Prueba de conexión - Productos en DB:", productos);
    if (prodError) console.error("❌ Error conectando a productos:", prodError);

    // Tu lógica original de pedidos
    const { data, error } = await supabase
      .from("pedidos")
      .select("*, mesas(numero)")
      .neq("estado", "pagado");

    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const activeOrders = useMemo(() => {
    const map: Record<number, any> = {};
    orders.forEach((o) => {
      const tableNum = o.mesas?.numero;
      if (
        tableNum &&
        (!map[tableNum] ||
          new Date(o.created_at) > new Date(map[tableNum].created_at))
      ) {
        map[tableNum] = o;
      }
    });
    return map;
  }, [orders]);

  if (loading)
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div>
      <h1 className="text-2xl font-display text-primary mb-6">Mesas</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: TOTAL_TABLES }, (_, i) => i + 1).map((table) => {
          const order = activeOrders[table];
          return (
            <motion.div
              key={table}
              onClick={() =>
                order ? setSelectedOrder(order) : setNewOrderTable(table)
              }
              className={`relative cursor-pointer rounded-xl border p-4 transition-all ${
                order
                  ? "bg-card border-border"
                  : "bg-secondary/50 border-dashed border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-display text-lg">Mesa {table}</span>
                {!order && <Plus size={16} />}
              </div>
              {order ? (
                <>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${statusClass[order.estado]}`}
                  >
                    {statusLabel[order.estado]}
                  </span>
                  <p className="text-primary font-semibold mt-3">
                    ${order.total}
                  </p>
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
          onCreated={fetchOrders}
        />
      )}
    </div>
  );
};

export default Dashboard;
