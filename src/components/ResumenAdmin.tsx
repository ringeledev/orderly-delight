import { useState, useEffect } from "react";
import { getResumenHoy, type ResumenDia } from "@/services/db";
import { TrendingUp, Users, ShoppingBag, Star, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ResumenAdmin = () => {
  const [resumen, setResumen] = useState<ResumenDia | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchResumen = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getResumenHoy();
      setResumen(data);
    } catch (err) {
      console.error("Error al cargar resumen:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchResumen();
  }, []);

  const today = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mb-6 bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-secondary/30 transition-all"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" />
          <span className="font-display text-sm text-foreground">
            Resumen de hoy
          </span>
          <span className="text-xs text-muted-foreground capitalize">{today}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fetchResumen(true);
            }}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-all"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
          {collapsed ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronUp size={16} className="text-muted-foreground" />}
        </div>
      </div>

      {/* Body */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t border-border px-4 py-4">
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-16 bg-secondary/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : !resumen ? (
                <p className="text-muted-foreground text-sm text-center py-2">
                  No se pudo cargar el resumen.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* Total recaudado */}
                  <MetricCard
                    icon={<TrendingUp size={16} />}
                    label="Recaudado"
                    value={`€${resumen.totalRecaudado.toFixed(2)}`}
                    highlight
                  />
                  {/* Pedidos cobrados */}
                  <MetricCard
                    icon={<ShoppingBag size={16} />}
                    label="Pedidos cobrados"
                    value={String(resumen.cantidadPedidos)}
                  />
                  {/* Ticket promedio */}
                  <MetricCard
                    icon={<TrendingUp size={16} />}
                    label="Ticket promedio"
                    value={`€${resumen.ticketPromedio.toFixed(2)}`}
                  />
                  {/* Clientes */}
                  <MetricCard
                    icon={<Users size={16} />}
                    label="Clientes"
                    value={
                      resumen.cantidadClientes > 0
                        ? String(resumen.cantidadClientes)
                        : "—"
                    }
                    sub={resumen.cantidadClientes === 0 ? "sin nombre registrado" : undefined}
                  />
                  {/* Producto estrella */}
                  <MetricCard
                    icon={<Star size={16} />}
                    label="Producto estrella"
                    value={resumen.productoEstrella?.nombre ?? "—"}
                    sub={
                      resumen.productoEstrella
                        ? `${resumen.productoEstrella.cantidad} vendidos`
                        : undefined
                    }
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Metric card ───────────────────────────────────────────────────────────────

const MetricCard = ({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) => (
  <div
    className={`rounded-lg p-3 ${
      highlight
        ? "bg-primary/10 border border-primary/20"
        : "bg-secondary/50 border border-border"
    }`}
  >
    <div className={`flex items-center gap-1.5 mb-1 ${highlight ? "text-primary" : "text-muted-foreground"}`}>
      {icon}
      <span className="text-xs">{label}</span>
    </div>
    <p
      className={`font-display text-base truncate ${
        highlight ? "text-primary" : "text-foreground"
      }`}
    >
      {value}
    </p>
    {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
  </div>
);

export default ResumenAdmin;
