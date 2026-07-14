import { useState, useEffect, useMemo } from "react";
import { getTodosPedidos, type Pedido } from "@/services/db";
import OrderDetailDialog from "@/components/OrderDetailDialog";
import { useRealtimePedidos } from "@/hooks/useRealtimePedidos";
import { Loader2, Search, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

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

type Vista = "activos" | "cobrados" | "anulados";
type FechaFiltro = "hoy" | "semana" | "todas";

const Orders = () => {
  const [orders, setOrders] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<Vista>("activos");
  const [search, setSearch] = useState("");
  const [fechaFiltro, setFechaFiltro] = useState<FechaFiltro>("hoy");
  const [selected, setSelected] = useState<Pedido | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await getTodosPedidos();
      setOrders(data);
    } catch (err) {
      console.error("Error al cargar pedidos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useRealtimePedidos(fetchOrders);

  const filtered = useMemo(() => {
    let result = orders;

    if (vista === "activos") {
      result = result.filter((o) => o.estado !== "cancelado" && o.estado !== "entregado");
    } else if (vista === "anulados") {
      result = result.filter((o) => o.motivo === "anulado");
    } else {
      result = result.filter((o) => o.motivo === "cobrado");

      // Filtro fecha (solo en cobrados)
      if (fechaFiltro !== "todas") {
        const ahora = new Date();
        const corte = new Date();
        if (fechaFiltro === "hoy") {
          corte.setHours(0, 0, 0, 0);
        } else {
          corte.setDate(ahora.getDate() - 7);
          corte.setHours(0, 0, 0, 0);
        }
        result = result.filter((o) => {
          const fecha = new Date(o.cerrado_at ?? o.created_at);
          return fecha >= corte;
        });
      }
    }

    // Búsqueda por mesa, cliente o mesero
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (o) =>
          String(o.mesas?.numero ?? "").includes(q) ||
          (o.cliente_nombre ?? "").toLowerCase().includes(q) ||
          (o.profiles?.nombre ?? "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [orders, vista, search, fechaFiltro]);

  const activosCount = orders.filter(
    (o) => o.estado !== "cancelado" && o.estado !== "entregado"
  ).length;
  const anuladosCount = orders.filter((o) => o.motivo === "anulado").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display text-primary">Pedidos</h1>
        <button
          onClick={fetchOrders}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Tabs principales */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setVista("activos")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            vista === "activos"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          Activos
          {activosCount > 0 && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                vista === "activos" ? "bg-white/20" : "bg-primary/20 text-primary"
              }`}
            >
              {activosCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setVista("cobrados")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            vista === "cobrados"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          Cobrados
        </button>
        <button
          onClick={() => setVista("anulados")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            vista === "anulados"
              ? "bg-destructive text-destructive-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          Anulados
          {anuladosCount > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              vista === "anulados" ? "bg-white/20" : "bg-destructive/20 text-destructive"
            }`}>
              {anuladosCount}
            </span>
          )}
        </button>
      </div>

      {/* Filtros secundarios */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 flex-1 bg-secondary rounded-lg px-3 py-1.5">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Buscar por mesa, cliente o mesero…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground w-full focus:outline-none"
          />
        </div>

        {vista === "cobrados" && (
          <div className="flex gap-1 shrink-0">
            {(["hoy", "semana", "todas"] as FechaFiltro[]).map((f) => (
              <button
                key={f}
                onClick={() => setFechaFiltro(f)}
                className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  fechaFiltro === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "hoy" ? "Hoy" : f === "semana" ? "7 días" : "Todas"}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-10">
          <Loader2 className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          {vista === "activos" ? "No hay pedidos activos" : vista === "anulados" ? "No hay pedidos anulados" : "No hay pedidos cobrados en este período"}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((order, i) => (
            <motion.div
              key={order.uuid}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              onClick={() => setSelected(order)}
              className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                order.motivo === "anulado"
                  ? "bg-destructive/5 border-destructive/20 hover:border-destructive/40"
                  : "bg-card border-border hover:border-primary/30"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">Mesa {order.mesas?.numero ?? "—"}</p>
                  {order.cliente_nombre && (
                    <span className="text-xs text-muted-foreground">— {order.cliente_nombre}</span>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  {order.detalles_pedido?.length ?? 0} ítems
                  {order.profiles?.nombre ? ` • ${order.profiles.nombre}` : ""}
                  {" • "}
                  {new Date(order.created_at).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {order.motivo === "anulado" ? (
                  <span className="text-xs px-2 py-1 rounded-full font-medium bg-destructive/15 text-destructive">
                    Anulado
                  </span>
                ) : (
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusClass[order.estado]}`}>
                    {statusLabel[order.estado]}
                  </span>
                )}
                <span className={`font-semibold ${order.motivo === "anulado" ? "line-through text-muted-foreground" : "text-primary"}`}>
                  €{Number(order.total).toFixed(2)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {selected && (
        <OrderDetailDialog
          order={selected}
          onClose={() => setSelected(null)}
          onUpdate={() => {
            setSelected(null);
            fetchOrders();
          }}
        />
      )}
    </div>
  );
};

export default Orders;
