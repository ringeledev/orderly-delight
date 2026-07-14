import { useState, useEffect, useMemo } from "react";
import {
  getPedidosCerrados,
  getReportesMeseros,
  type Pedido,
  type MeseroStats,
} from "@/services/db";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { format, startOfWeek, startOfMonth, isAfter, subDays, subWeeks, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, RefreshCw, User, TrendingUp, UtensilsCrossed, GlassWater, UserCog, Receipt, ShoppingBag, Package, LayoutGrid, FileSpreadsheet } from "lucide-react";
import { exportarReporteExcel } from "@/services/exportExcel";
import { Button } from "@/components/ui/button";

const COLORS = [
  "hsl(42,80%,55%)", "hsl(10,70%,50%)", "hsl(150,60%,45%)",
  "hsl(210,60%,50%)", "hsl(280,60%,50%)", "hsl(30,80%,50%)",
];

type Period = "day" | "week" | "month";
type Tab = "general" | "meseros" | "historial";

const CATEGORIAS_BEBIDA = ["bebida", "bebidas", "coctel", "cocteles", "bar", "trago", "tragos", "jugo", "jugos"];
const esBebida = (cat?: string) => CATEGORIAS_BEBIDA.includes((cat ?? "").toLowerCase());

const Reports = () => {
  const [period, setPeriod] = useState<Period>("day");
  const [tab, setTab] = useState<Tab>("general");
  const [orders, setOrders] = useState<Pedido[]>([]);
  const [meseroStats, setMeseroStats] = useState<MeseroStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportando, setExportando] = useState(false);

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [ordersData, meseroData] = await Promise.all([
        getPedidosCerrados(),
        getReportesMeseros(30),
      ]);
      setOrders(ordersData);
      setMeseroStats(meseroData);
    } catch (err) {
      console.error("Error al cargar reportes:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const cutoff = useMemo(() => {
    const now = new Date();
    if (period === "day") return subDays(now, 7);
    if (period === "week") return subWeeks(now, 4);
    return subMonths(now, 6);
  }, [period]);

  // Separar consumo de clientes reales del consumo interno (Mesas de Personal)
  const ordersClientes = useMemo(() => orders.filter((o) => !o.mesas?.es_personal), [orders]);
  const ordersPersonal = useMemo(() => orders.filter((o) => o.mesas?.es_personal), [orders]);

  const filteredOrders = useMemo(
    () => ordersClientes.filter((o) => isAfter(new Date(o.cerrado_at ?? o.created_at), cutoff)),
    [ordersClientes, cutoff]
  );

  // Para cálculos de ingresos, solo contar pedidos cobrados (motivo="cobrado")
  const filteredOrdersValidos = useMemo(
    () => filteredOrders.filter((o) => o.motivo === "cobrado"),
    [filteredOrders]
  );

  const filteredPersonal = useMemo(
    () => ordersPersonal.filter((o) => isAfter(new Date(o.cerrado_at ?? o.created_at), cutoff)),
    [ordersPersonal, cutoff]
  );
  const totalPersonal = filteredPersonal.reduce((s, o) => s + Number(o.total), 0);

  const totalRevenue = filteredOrdersValidos.reduce((s, o) => s + Number(o.total), 0);
  const totalOrders = filteredOrdersValidos.length;

  const revenueByDate = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOrdersValidos.forEach((o) => {
      const d = new Date(o.cerrado_at ?? o.created_at);
      let key: string;
      if (period === "day") key = format(d, "dd/MM", { locale: es });
      else if (period === "week") key = "Sem " + format(startOfWeek(d), "dd/MM", { locale: es });
      else key = format(startOfMonth(d), "MMM yyyy", { locale: es });
      map[key] = (map[key] ?? 0) + Number(o.total);
    });
    return Object.entries(map).map(([name, total]) => ({ name, total }));
  }, [filteredOrdersValidos, period]);

  const productSales = useMemo(() => {
    const map: Record<string, { name: string; total: number; qty: number; categoria: string }> = {};
    filteredOrdersValidos.forEach((o) => {
      (o.detalles_pedido ?? []).forEach((d) => {
        const key = d.producto_id ?? `extra_${d.nombre_extra}`;
        const name = d.productos?.nombre ?? d.nombre_extra ?? "Extra";
        const categoria = d.productos?.categoria ?? "";
        if (!map[key]) map[key] = { name, total: 0, qty: 0, categoria };
        map[key].total += d.precio_historico * d.cantidad;
        map[key].qty += d.cantidad;
      });
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredOrdersValidos]);

  const bebidas = productSales.filter((p) => esBebida(p.categoria));
  const comidas = productSales.filter((p) => !esBebida(p.categoria));
  const totalBebidas = bebidas.reduce((s, p) => s + p.total, 0);
  const totalComidas = comidas.reduce((s, p) => s + p.total, 0);

  // Desglose por TODAS las categorías reales (no solo bebida/comida)
  const salesByCategory = useMemo(() => {
    const map: Record<string, { categoria: string; total: number; qty: number }> = {};
    productSales.forEach((p) => {
      const cat = p.categoria || "Sin categoría";
      if (!map[cat]) map[cat] = { categoria: cat, total: 0, qty: 0 };
      map[cat].total += p.total;
      map[cat].qty += p.qty;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [productSales]);

  const ticketPromedio = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalItemsVendidos = productSales.reduce((s, p) => s + p.qty, 0);
  const mesasAtendidas = new Set(filteredOrdersValidos.map((o) => o.mesas?.numero).filter(Boolean)).size;

  if (loading)
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display text-primary">Reportes</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={exportando}
            onClick={async () => {
              setExportando(true);
              try {
                await exportarReporteExcel({
                  orders: filteredOrders,
                  ordersPersonal: filteredPersonal,
                  periodoLabel: `${period === "day" ? "Diario" : period === "week" ? "Semanal" : "Mensual"} — generado ${new Date().toLocaleString("es-AR")}`,
                });
              } finally {
                setExportando(false);
              }
            }}
          >
            {exportando ? (
              <Loader2 size={15} className="mr-1.5 animate-spin" />
            ) : (
              <FileSpreadsheet size={15} className="mr-1.5" />
            )}
            Exportar Excel
          </Button>
          <button
            onClick={() => fetchData(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {([
          { key: "general", label: "General" },
          { key: "meseros", label: "Por Mesero" },
          { key: "historial", label: "Historial" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-sm transition-all ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── General ── */}
      {tab === "general" && (
        <>
          <div className="flex gap-2 mb-4">
            {(["day", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {p === "day" ? "Diario" : p === "week" ? "Semanal" : "Mensual"}
              </button>
            ))}
          </div>

          {/* KPIs principales */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-0.5">
                <TrendingUp size={12} /> Ingresos
              </div>
              <p className="text-2xl font-display text-primary">€{totalRevenue.toFixed(2)}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-0.5">
                <Receipt size={12} /> Pedidos
              </div>
              <p className="text-2xl font-display text-foreground">{totalOrders}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-0.5">
                <TrendingUp size={12} /> Ticket prom.
              </div>
              <p className="text-2xl font-display text-foreground">€{ticketPromedio.toFixed(2)}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-0.5">
                <ShoppingBag size={12} /> Ítems vendidos
              </div>
              <p className="text-2xl font-display text-foreground">{totalItemsVendidos}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 col-span-2 lg:col-span-1">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-0.5">
                <LayoutGrid size={12} /> Mesas atendidas
              </div>
              <p className="text-2xl font-display text-foreground">{mesasAtendidas}</p>
            </div>
          </div>

          {/* Desglose por TODAS las categorías */}
          <div className="bg-card border border-border rounded-xl p-4 mb-6">
            <h2 className="font-display text-foreground mb-4">Ventas por Categoría</h2>
            {salesByCategory.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {salesByCategory.map((cat, i) => {
                  const bebida = esBebida(cat.categoria);
                  const pct = totalRevenue > 0 ? (cat.total / totalRevenue) * 100 : 0;
                  return (
                    <div
                      key={cat.categoria}
                      className={`rounded-lg p-3 border ${
                        bebida ? "bg-blue-500/5 border-blue-500/20" : "bg-secondary/40 border-border"
                      }`}
                    >
                      <div className={`flex items-center gap-1.5 text-xs mb-1 ${bebida ? "text-blue-400" : "text-muted-foreground"}`}>
                        {bebida ? <GlassWater size={13} /> : cat.categoria.toLowerCase().includes("comida") ? <UtensilsCrossed size={13} /> : <Package size={13} />}
                        <span className="truncate">{cat.categoria}</span>
                      </div>
                      <p className={`font-display text-lg ${bebida ? "text-blue-200" : "text-foreground"}`}>
                        €{cat.total.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">{cat.qty} unidades · {pct.toFixed(0)}%</p>
                      <div className="h-1 bg-black/20 rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Gráfico comparativo de categorías */}
          {salesByCategory.length > 1 && (
            <div className="bg-card border border-border rounded-xl p-4 mb-6">
              <h2 className="font-display text-foreground mb-4">Comparativa de Categorías</h2>
              <ResponsiveContainer width="100%" height={Math.max(180, salesByCategory.length * 40)}>
                <BarChart data={salesByCategory} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" tick={{ fill: "hsl(30,15%,55%)", fontSize: 11 }} />
                  <YAxis type="category" dataKey="categoria" width={110} tick={{ fill: "hsl(30,15%,55%)", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(30,12%,12%)", border: "1px solid hsl(30,12%,20%)", borderRadius: 8, color: "hsl(38,60%,92%)" }} />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                    {salesByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {filteredPersonal.length > 0 && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
              <UserCog size={18} className="text-purple-400 shrink-0" />
              <div>
                <p className="text-sm font-display text-purple-300">
                  Consumo Personal: €{totalPersonal.toFixed(2)} en {filteredPersonal.length} pedido
                  {filteredPersonal.length !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  No incluido en "Ingresos" — es consumo interno, no ventas a clientes.
                </p>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-4 mb-6">
            <h2 className="font-display text-foreground mb-4">
              Ganancias por {period === "day" ? "Día" : period === "week" ? "Semana" : "Mes"}
            </h2>
            {revenueByDate.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueByDate}>
                  <XAxis dataKey="name" tick={{ fill: "hsl(30,15%,55%)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(30,15%,55%)", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(30,12%,12%)", border: "1px solid hsl(30,12%,20%)", borderRadius: 8, color: "hsl(38,60%,92%)" }} />
                  <Bar dataKey="total" fill="hsl(42,80%,55%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">Sin datos</p>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-display text-foreground mb-4">Ventas por Producto</h2>
              {productSales.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={productSales.slice(0, 6)} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                      {productSales.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(30,12%,12%)", border: "1px solid hsl(30,12%,20%)", borderRadius: 8, color: "hsl(38,60%,92%)" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-center py-8">Sin datos</p>}
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-display text-foreground mb-4">Detalle de Productos</h2>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {productSales.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Sin datos</p>
                ) : (
                  productSales.map((p, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <div>
                        <p className="text-foreground">{p.name}</p>
                        <p className="text-muted-foreground text-xs">{p.qty} vendidos{p.categoria ? ` · ${p.categoria}` : ""}</p>
                      </div>
                      <span className="text-primary font-semibold">€{p.total.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Por Mesero ── */}
      {tab === "meseros" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="font-display text-foreground mb-1">Recaudación por Mesero</h2>
            <p className="text-muted-foreground text-xs mb-4">Últimos 30 días</p>
            {meseroStats.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={meseroStats.map((m) => ({ name: m.nombre.split(" ")[0], total: m.total }))}>
                    <XAxis dataKey="name" tick={{ fill: "hsl(30,15%,55%)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(30,15%,55%)", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "hsl(30,12%,12%)", border: "1px solid hsl(30,12%,20%)", borderRadius: 8, color: "hsl(38,60%,92%)" }} />
                    <Bar dataKey="total" fill="hsl(150,60%,45%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-4 space-y-2">
                  {meseroStats.map((m, i) => (
                    <div key={m.mesero_id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                      <span className="text-lg font-display text-muted-foreground w-6">#{i + 1}</span>
                      <div className="flex items-center gap-2 flex-1">
                        <User size={15} className="text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-foreground text-sm font-medium">{m.nombre}</p>
                          <p className="text-muted-foreground text-xs">{m.pedidos} pedido{m.pedidos !== 1 ? "s" : ""} cobrado{m.pedidos !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-primary font-semibold">€{m.total.toFixed(2)}</p>
                        <p className="text-muted-foreground text-xs">
                          prom. €{m.pedidos > 0 ? (m.total / m.pedidos).toFixed(2) : "0.00"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Bebidas vs Comidas */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <GlassWater size={15} className="text-blue-400" />
                <h2 className="font-display text-foreground">Bebidas más vendidas</h2>
              </div>
              {bebidas.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">Sin datos</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {bebidas.slice(0, 8).map((p, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-foreground">{p.name}</span>
                      <span className="text-muted-foreground text-xs">{p.qty}x · €{p.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <UtensilsCrossed size={15} className="text-orange-400" />
                <h2 className="font-display text-foreground">Comidas más vendidas</h2>
              </div>
              {comidas.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">Sin datos</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {comidas.slice(0, 8).map((p, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-foreground">{p.name}</span>
                      <span className="text-muted-foreground text-xs">{p.qty}x · €{p.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Historial ── */}
      {tab === "historial" && (
        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border">
            <h2 className="font-display text-foreground">Historial de Transacciones</h2>
            <p className="text-muted-foreground text-xs">{orders.length} pedidos cobrados en total</p>
          </div>
          <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {orders.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">Sin historial</p>
            ) : (
              orders.map((o) => {
                const anulado = o.motivo === "anulado";
                return (
                <div key={o.uuid} className={`flex items-center justify-between px-4 py-3 ${anulado ? "bg-destructive/5" : o.mesas?.es_personal ? "bg-purple-500/5" : ""}`}>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-medium ${anulado ? "text-muted-foreground" : "text-foreground"}`}>
                        Mesa {o.mesas?.numero ?? "—"}
                      </p>
                      {o.cliente_nombre && (
                        <span className="text-xs text-muted-foreground">— {o.cliente_nombre}</span>
                      )}
                      {anulado && (
                        <span className="text-xs text-destructive bg-destructive/15 px-1.5 py-0.5 rounded-full font-medium">
                          Anulado
                        </span>
                      )}
                      {o.mesas?.es_personal && !anulado && (
                        <span className="flex items-center gap-1 text-xs text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-full">
                          <UserCog size={10} /> Personal
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {o.profiles?.nombre ?? "—"} ·{" "}
                      {o.detalles_pedido?.length ?? 0} ítems ·{" "}
                      {new Date(o.cerrado_at ?? o.created_at).toLocaleString("es-AR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className={`font-semibold ${anulado ? "line-through text-muted-foreground" : "text-primary"}`}>
                    €{Number(o.total).toFixed(2)}
                  </span>
                </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
