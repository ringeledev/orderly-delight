import { useState, useEffect, useCallback } from "react";
import { getPedidosActivos, updateEstadoPedido, type Pedido, type EstadoPedido } from "@/services/db";
import { useRealtimePedidos } from "@/hooks/useRealtimePedidos";
import { Loader2, ChefHat, Clock, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ESTADOS_COCINA: EstadoPedido[] = ["pendiente", "en_preparacion", "listo"];

const estadoConfig: Record<
  string,
  { label: string; next: EstadoPedido | null; nextLabel: string; bg: string; border: string; badge: string }
> = {
  pendiente: {
    label: "Pendiente",
    next: "en_preparacion",
    nextLabel: "Iniciar",
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
    badge: "bg-amber-500/20 text-amber-400",
  },
  en_preparacion: {
    label: "En preparación",
    next: "listo",
    nextLabel: "Listo ✓",
    bg: "bg-blue-500/10",
    border: "border-blue-500/40",
    badge: "bg-blue-500/20 text-blue-400",
  },
  listo: {
    label: "Listo para entregar",
    next: null,
    nextLabel: "",
    bg: "bg-green-500/10",
    border: "border-green-500/40",
    badge: "bg-green-500/20 text-green-400",
  },
};

function tiempoTranscurrido(created_at: string): string {
  const diff = Math.floor((Date.now() - new Date(created_at).getTime()) / 60000);
  if (diff < 1) return "< 1 min";
  if (diff === 1) return "1 min";
  return `${diff} min`;
}

function tiempoUrgente(created_at: string): boolean {
  return (Date.now() - new Date(created_at).getTime()) / 60000 > 12;
}

const Cocina = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [avanzando, setAvanzando] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const fetchPedidos = useCallback(async () => {
    try {
      const data = await getPedidosActivos();
      setPedidos(data.filter((p) => ESTADOS_COCINA.includes(p.estado)));
    } catch (err) {
      console.error("Error al cargar pedidos de cocina:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPedidos();
    // Tick each minute to refresh elapsed times
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, [fetchPedidos]);

  useRealtimePedidos(fetchPedidos);

  const handleAvanzar = async (pedido: Pedido) => {
    const cfg = estadoConfig[pedido.estado];
    if (!cfg.next || avanzando) return;
    setAvanzando(pedido.uuid);
    try {
      await updateEstadoPedido(pedido.uuid, cfg.next, pedido.mesa_id);
      await fetchPedidos();
    } catch (err) {
      console.error("Error al avanzar estado:", err);
    } finally {
      setAvanzando(null);
    }
  };

  // Group by estado preserving order priority
  const porEstado: Record<string, Pedido[]> = { pendiente: [], en_preparacion: [], listo: [] };
  pedidos.forEach((p) => {
    if (porEstado[p.estado]) porEstado[p.estado].push(p);
  });

  if (loading)
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ChefHat size={24} className="text-primary" />
        <h1 className="text-2xl font-display text-primary">Vista de Cocina</h1>
        <span className="ml-auto text-xs text-muted-foreground">
          {pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""} activo{pedidos.length !== 1 ? "s" : ""}
        </span>
      </div>

      {pedidos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <ChefHat size={48} className="opacity-20" />
          <p className="text-lg">Sin pedidos pendientes</p>
          <p className="text-sm opacity-60">Los pedidos nuevos aparecen aquí en tiempo real</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ESTADOS_COCINA.map((estado) => {
            const lista = porEstado[estado];
            const cfg = estadoConfig[estado];
            return (
              <div key={estado} className="space-y-3">
                {/* Column header */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${cfg.bg} border ${cfg.border}`}>
                  <span className="font-display text-sm text-foreground">{cfg.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                    {lista.length}
                  </span>
                </div>

                {/* Cards */}
                <AnimatePresence mode="popLayout">
                  {lista.map((pedido) => {
                    const urgente = tiempoUrgente(pedido.uuid ? pedido.created_at : "");
                    const elapsed = tiempoTranscurrido(pedido.created_at);
                    const detalles = pedido.detalles_pedido ?? [];

                    return (
                      <motion.div
                        key={pedido.uuid}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className={`rounded-xl border p-4 space-y-3 ${cfg.bg} ${cfg.border} ${
                          urgente ? "ring-2 ring-red-500/50" : ""
                        }`}
                      >
                        {/* Card header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-display text-foreground text-lg">
                              Mesa {pedido.mesas?.numero ?? "—"}
                            </p>
                            {pedido.cliente_nombre && (
                              <p className="text-xs text-muted-foreground">{pedido.cliente_nombre}</p>
                            )}
                          </div>
                          <div className={`flex items-center gap-1 text-xs ${urgente ? "text-red-400" : "text-muted-foreground"}`}>
                            {urgente && <AlertCircle size={12} />}
                            <Clock size={12} />
                            <span>{elapsed}</span>
                          </div>
                        </div>

                        {/* Items */}
                        <ul className="space-y-2">
                          {detalles.map((d, i) => (
                            <li key={d.uuid ?? i} className="space-y-0.5">
                              <div className="flex items-baseline gap-2">
                                <span className="text-primary font-bold text-lg leading-none">
                                  ×{d.cantidad}
                                </span>
                                <span className="text-foreground font-medium text-sm">
                                  {d.productos?.nombre ?? "—"}
                                </span>
                              </div>
                              {d.notas && (
                                <p className="text-xs text-amber-400 pl-6 italic">
                                  ⚠ {d.notas}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>

                        {/* Action button */}
                        {cfg.next && (
                          <button
                            onClick={() => handleAvanzar(pedido)}
                            disabled={avanzando === pedido.uuid}
                            className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
                              estado === "pendiente"
                                ? "bg-amber-500 hover:bg-amber-400 text-black"
                                : "bg-blue-500 hover:bg-blue-400 text-white"
                            } disabled:opacity-50`}
                          >
                            {avanzando === pedido.uuid ? (
                              <span className="flex items-center justify-center gap-2">
                                <Loader2 size={14} className="animate-spin" />
                                Guardando…
                              </span>
                            ) : (
                              cfg.nextLabel
                            )}
                          </button>
                        )}

                        {estado === "listo" && (
                          <div className="text-center text-green-400 text-sm font-medium py-1">
                            ✓ Listo para entregar
                          </div>
                        )}
                      </motion.div>
                    );
                  })}

                  {lista.length === 0 && (
                    <div className="text-center text-muted-foreground/40 text-sm py-8 border border-dashed border-border rounded-xl">
                      Sin pedidos
                    </div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Cocina;
