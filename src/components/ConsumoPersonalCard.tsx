import { useState, useEffect } from "react";
import { getConsumoPersonalDetallado, type ConsumoPersonalDetalle } from "@/services/db";
import {
  UserCog, ChevronDown, ChevronUp, RefreshCw, GlassWater, UtensilsCrossed, Package, Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIAS_BEBIDA = ["bebidas", "extras bebidas", "bebida", "extra bebidas", "extras bebida"];
const esBebida = (cat: string) => CATEGORIAS_BEBIDA.includes(cat.trim().toLowerCase());

const iconoCategoria = (categoria: string) => {
  if (esBebida(categoria)) return <GlassWater size={14} />;
  if (categoria.toLowerCase().includes("comida")) return <UtensilsCrossed size={14} />;
  return <Package size={14} />;
};

type Periodo = "hoy" | "semana" | "mes" | "todo";
const DIAS_POR_PERIODO: Record<Periodo, number> = { hoy: 1, semana: 7, mes: 30, todo: 3650 };

const ConsumoPersonalCard = () => {
  const [periodo, setPeriodo] = useState<Periodo>("hoy");
  const [data, setData] = useState<ConsumoPersonalDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [categoriaAbierta, setCategoriaAbierta] = useState<string | null>(null);

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await getConsumoPersonalDetallado(DIAS_POR_PERIODO[periodo]);
      setData(result);
      // Auto-abrir la categoría de bebidas si tiene consumo
      const bebidasCat = result.categorias.find((c) => esBebida(c.categoria));
      if (bebidasCat) setCategoriaAbierta(bebidasCat.categoria);
    } catch (err) {
      console.error("Error al cargar consumo personal:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [periodo]);

  if (!loading && (!data || data.cantidadPedidos === 0)) {
    return null; // No mostrar la card si no hay consumo de personal en absoluto
  }

  const maxCategoriaTotal = data?.categorias[0]?.total ?? 1;
  const bebidasYExtras = data?.categorias.filter((c) => esBebida(c.categoria)) ?? [];
  const totalBebidasPersonal = bebidasYExtras.reduce((s, c) => s + c.total, 0);
  const cantidadBebidasPersonal = bebidasYExtras.reduce((s, c) => s + c.cantidad, 0);

  return (
    <div className="mb-6 bg-purple-500/5 border border-purple-500/20 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-purple-500/10 transition-all"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <UserCog size={16} className="text-purple-400" />
          <span className="font-display text-sm text-foreground">Consumo Personal</span>
          <span className="text-xs text-purple-400/70">(no es venta a clientes)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); fetchData(true); }}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-all"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
          {collapsed ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronUp size={16} className="text-muted-foreground" />}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t border-purple-500/20 px-4 py-4 space-y-4">
              {/* Selector de período */}
              <div className="flex gap-1.5">
                {(["hoy", "semana", "mes", "todo"] as Periodo[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodo(p)}
                    className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                      periodo === p
                        ? "bg-purple-500 text-white"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p === "hoy" ? "Hoy" : p === "semana" ? "7 días" : p === "mes" ? "30 días" : "Todo"}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-purple-400" size={20} />
                </div>
              ) : data && data.cantidadPedidos > 0 ? (
                <>
                  {/* Totales destacados */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                      <p className="text-purple-400 text-xs">Total consumido</p>
                      <p className="font-display text-lg text-purple-200">${data.total.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{data.cantidadPedidos} pedidos</p>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                      <div className="flex items-center gap-1 text-blue-400 text-xs">
                        <GlassWater size={12} /> Bebidas + Extras
                      </div>
                      <p className="font-display text-lg text-blue-200">${totalBebidasPersonal.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{cantidadBebidasPersonal} unidades</p>
                    </div>
                    <div className="bg-secondary/50 border border-border rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">% del total</p>
                      <p className="font-display text-lg text-foreground">
                        {data.total > 0 ? ((totalBebidasPersonal / data.total) * 100).toFixed(0) : 0}%
                      </p>
                      <p className="text-xs text-muted-foreground">es bebida</p>
                    </div>
                  </div>

                  {/* Desglose por categoría */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Desglose por categoría</p>
                    {data.categorias.map((cat) => {
                      const isOpen = categoriaAbierta === cat.categoria;
                      const bebida = esBebida(cat.categoria);
                      const pct = maxCategoriaTotal > 0 ? (cat.total / maxCategoriaTotal) * 100 : 0;
                      return (
                        <div
                          key={cat.categoria}
                          className={`rounded-lg border overflow-hidden ${
                            bebida ? "border-blue-500/30 bg-blue-500/5" : "border-border bg-secondary/30"
                          }`}
                        >
                          <button
                            onClick={() => setCategoriaAbierta(isOpen ? null : cat.categoria)}
                            className="w-full flex items-center justify-between px-3 py-2 text-left"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className={bebida ? "text-blue-400" : "text-muted-foreground"}>
                                {iconoCategoria(cat.categoria)}
                              </span>
                              <span className="text-sm text-foreground truncate">{cat.categoria}</span>
                              <span className="text-xs text-muted-foreground shrink-0">({cat.cantidad}u)</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-sm font-medium ${bebida ? "text-blue-300" : "text-foreground"}`}>
                                ${cat.total.toFixed(2)}
                              </span>
                              {isOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                            </div>
                          </button>
                          {/* Barra de proporción */}
                          <div className="px-3 pb-2">
                            <div className="h-1 bg-black/20 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${bebida ? "bg-blue-400" : "bg-muted-foreground/40"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          {isOpen && (
                            <div className="px-3 pb-3 space-y-1 border-t border-border/50 pt-2">
                              {cat.items.map((item, i) => (
                                <div key={i} className="flex justify-between text-xs">
                                  <span className="text-foreground">{item.cantidad}× {item.nombre}</span>
                                  <span className="text-muted-foreground">${item.total.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">
                  Sin consumo de personal en este período.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ConsumoPersonalCard;
