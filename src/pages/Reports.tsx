import { useState, useMemo } from "react";
import { store } from "@/lib/store";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, startOfWeek, startOfMonth, isAfter, subDays, subWeeks, subMonths } from "date-fns";
import { es } from "date-fns/locale";

const COLORS = ["hsl(42,80%,55%)", "hsl(10,70%,50%)", "hsl(150,60%,45%)", "hsl(210,60%,50%)", "hsl(280,60%,50%)", "hsl(30,80%,50%)"];

type Period = "day" | "week" | "month";

const Reports = () => {
  const [period, setPeriod] = useState<Period>("day");
  
  // 🛠️ CORRECCIÓN 1 (image_b18d6e.png): Agregamos (o: any) para evitar el error en .status
  const orders = store.getOrders().filter((o: any) => o.status === "Pagado" || o.status === "paid");

  const cutoff = useMemo(() => {
    const now = new Date();
    if (period === "day") return subDays(now, 7);
    if (period === "week") return subWeeks(now, 4);
    return subMonths(now, 6);
  }, [period]);

  // 🛠️ CORRECCIÓN 2 (image_b19090.png): Usamos (o: any) y leemos dinámicamente timestamp o createdAt
  const filteredOrders = useMemo(
    () => orders.filter((o: any) => {
      const rawDate = o.timestamp || o.createdAt || Date.now();
      const orderDate = new Date(rawDate);
      return isAfter(orderDate, cutoff);
    }),
    [orders, cutoff]
  );

  const totalRevenue = filteredOrders.reduce((s, o) => s + o.total, 0);
  const totalOrders = filteredOrders.length;

  const revenueByDate = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOrders.forEach((o: any) => {
      // 🛠️ CORRECCIÓN 3 (image_b19090.png): Consistencia al leer la fecha de la orden
      const rawDate = o.timestamp || o.createdAt || Date.now();
      const d = new Date(rawDate);
      
      let key: string;
      if (period === "day") key = format(d, "dd/MM", { locale: es });
      else if (period === "week") key = "Sem " + format(startOfWeek(d), "dd/MM", { locale: es });
      else key = format(startOfMonth(d), "MMM yyyy", { locale: es });
      map[key] = (map[key] || 0) + o.total;
    });
    return Object.entries(map).map(([name, total]) => ({ name, total }));
  }, [filteredOrders, period]);

  const productSales = useMemo(() => {
    const map: Record<string, { name: string; total: number; qty: number }> = {};
    filteredOrders.forEach((o) => {
      o.items.forEach((item) => {
        const key = item.product.id;
        if (!map[key]) map[key] = { name: item.product.name, total: 0, qty: 0 };
        map[key].total += item.product.price * item.quantity;
        map[key].qty += item.quantity;
      });
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredOrders]);

  return (
    <div>
      <h1 className="text-2xl font-display text-primary mb-4">Reportes</h1>

      <div className="flex gap-2 mb-6">
        {(["day", "week", "month"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-full text-sm transition-all ${
              period === p ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {p === "day" ? "Diario" : p === "week" ? "Semanal" : "Mensual"}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-muted-foreground text-xs">Ingresos Totales</p>
          <p className="text-2xl font-display text-primary">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-muted-foreground text-xs">Pedidos Completados</p>
          <p className="text-2xl font-display text-foreground">{totalOrders}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-muted-foreground text-xs">Ticket Promedio</p>
          <p className="text-2xl font-display text-foreground">
            ${totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : "0.00"}
          </p>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <h2 className="font-display text-foreground mb-4">Ganancias por {period === "day" ? "Día" : period === "week" ? "Semana" : "Mes"}</h2>
        {revenueByDate.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revenueByDate}>
              <XAxis dataKey="name" tick={{ fill: "hsl(30,15%,55%)", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(30,15%,55%)", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: "hsl(30,12%,12%)", border: "1px solid hsl(30,12%,20%)", borderRadius: 8, color: "hsl(38,60%,92%)" }}
              />
              <Bar dataKey="total" fill="hsl(42,80%,55%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted-foreground text-center py-8">No hay datos para este período</p>
        )}
      </div>

      {/* Product Sales */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-display text-foreground mb-4">Ventas por Producto</h2>
          {productSales.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={productSales.slice(0, 6)} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name }) => name}>
                  {productSales.slice(0, 6).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(30,12%,12%)", border: "1px solid hsl(30,12%,20%)", borderRadius: 8, color: "hsl(38,60%,92%)" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-8">Sin datos</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-display text-foreground mb-4">Detalle de Productos</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {productSales.map((p, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <div>
                  <p className="text-foreground">{p.name}</p>
                  <p className="text-muted-foreground text-xs">{p.qty} vendidos</p>
                </div>
                <span className="text-primary font-semibold">${p.total.toFixed(2)}</span>
              </div>
            ))}
            {productSales.length === 0 && <p className="text-muted-foreground text-center py-8">Sin datos</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;