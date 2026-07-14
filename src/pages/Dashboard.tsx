import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPedidosActivos,
  getMesas,
  createMesa,
  deleteMesa,
  type Pedido,
  type Mesa,
} from "@/services/db";
import NewOrderDialog from "@/components/NewOrderDialog";
import MesaDetailDialog from "@/components/MesaDetailDialog";
import ResumenAdmin from "@/components/ResumenAdmin";
import ConsumoPersonalCard from "@/components/ConsumoPersonalCard";
import { useRealtimePedidos } from "@/hooks/useRealtimePedidos";
import { Plus, Trash2, Loader2, Users, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

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

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [orders, setOrders] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrderTable, setNewOrderTable] = useState<number | null>(null);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [addOrderToMesa, setAddOrderToMesa] = useState<Mesa | null>(null);
  const [addMesaDialog, setAddMesaDialog] = useState<{ esPersonal: boolean } | null>(null);

  const fetchAll = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [mesasData, pedidosData] = await Promise.all([getMesas(), getPedidosActivos()]);
      setMesas(mesasData);
      setOrders(pedidosData);
    } catch (err) {
      console.error("Error al cargar datos:", err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll(true);
  }, []);

  useRealtimePedidos(fetchAll);

  const ordersByTable = useMemo(() => {
    const map: Record<number, Pedido[]> = {};
    orders.forEach((o) => {
      const num = o.mesas?.numero;
      if (!num) return;
      if (!map[num]) map[num] = [];
      map[num].push(o);
    });
    return map;
  }, [orders]);

  const getLideresForTable = (tableNum: number): string[] =>
    (ordersByTable[tableNum] ?? [])
      .map((p) => p.cliente_nombre)
      .filter((n): n is string => Boolean(n));

  const sugerirNumero = (esPersonal: boolean) => {
    const normales = mesas.filter((m) => !m.es_personal);
    const personales = mesas.filter((m) => m.es_personal);
    return esPersonal
      ? 900 + (personales.length > 0 ? Math.max(...personales.map((m) => m.numero - 900)) : 0) + 1
      : normales.length > 0
      ? Math.max(...normales.map((m) => m.numero)) + 1
      : 1;
  };

  const handleCrearMesa = async (numero: number, esPersonal: boolean) => {
    try {
      const nueva = await createMesa(numero, esPersonal);
      setMesas((prev) => [...prev, nueva]);
      setAddMesaDialog(null);
    } catch (err: any) {
      console.error("Error al agregar mesa:", err);
      toast({
        title: "No se pudo agregar la mesa",
        description: err?.message ?? "Error desconocido. Revisá la consola.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMesa = async (mesa: Mesa, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar Mesa ${mesa.numero}?`)) return;
    try {
      await deleteMesa(mesa.uuid);
      setMesas((prev) => prev.filter((m) => m.uuid !== mesa.uuid));
    } catch (err) {
      console.error("Error al eliminar mesa:", err);
    }
  };

  const mesasNormales = mesas.filter((m) => !m.es_personal).sort((a, b) => a.numero - b.numero);
  const mesasPersonales = mesas.filter((m) => m.es_personal).sort((a, b) => a.numero - b.numero);

  if (loading)
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="animate-spin" />
      </div>
    );

  const MesaCard = ({ mesa }: { mesa: Mesa }) => {
    const pedidosMesa = ordersByTable[mesa.numero] ?? [];
    const ocupada = pedidosMesa.length > 0;
    const total = pedidosMesa.reduce((s, p) => {
      const detalles = p.detalles_pedido ?? [];
      return s + detalles.filter((d) => !d.cobrado).reduce((ds, d) => ds + d.precio_historico * d.cantidad, 0);
    }, 0);
    const prioridad = ["pendiente", "en_preparacion", "listo", "entregado"];
    const estadoMostrar = pedidosMesa
      .map((p) => p.estado)
      .sort((a, b) => prioridad.indexOf(a) - prioridad.indexOf(b))[0];

    // Color del primer mesero activo en esta mesa
    const meseroColor = pedidosMesa[0]?.profiles?.color ?? null;

    return (
      <motion.div
        key={mesa.uuid}
        layout
        onClick={() => {
          if (ocupada) {
            setSelectedMesa(mesa);
          } else {
            setNewOrderTable(mesa.numero);
          }
        }}
        className={`relative cursor-pointer rounded-xl border p-4 transition-all ${
          ocupada
            ? mesa.es_personal
              ? "bg-purple-500/10 border-purple-500/30"
              : meseroColor
              ? ""
              : "bg-card border-border"
            : mesa.es_personal
            ? "bg-purple-500/5 border-dashed border-purple-500/20"
            : "bg-secondary/50 border-dashed border-border"
        }`}
        style={
          ocupada && meseroColor && !mesa.es_personal
            ? { backgroundColor: `${meseroColor}18`, borderColor: `${meseroColor}60` }
            : undefined
        }
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {mesa.es_personal && <UserCog size={13} className="text-purple-400" />}
            <span className="font-display text-lg">
              {mesa.es_personal ? `Personal ${mesa.numero - 900}` : `Mesa ${mesa.numero}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {!ocupada && <Plus size={16} className="text-muted-foreground" />}
            {isAdmin && !ocupada && (
              <button
                onClick={(e) => handleDeleteMesa(mesa, e)}
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {ocupada ? (
          <>
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              {estadoMostrar && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass[estadoMostrar]}`}>
                  {statusLabel[estadoMostrar]}
                </span>
              )}
              {pedidosMesa.length > 1 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users size={12} />
                  {pedidosMesa.length}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-primary font-semibold">€{total.toFixed(2)}</p>
              {meseroColor && (
                <span
                  className="flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${meseroColor}30`, color: meseroColor }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meseroColor }} />
                  {pedidosMesa[0]?.profiles?.nombre ?? ""}
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-xs">Disponible</p>
        )}
      </motion.div>
    );
  };

  return (
    <div>
      {isAdmin && <ResumenAdmin />}
      {isAdmin && <ConsumoPersonalCard />}

      {/* Mesas normales */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display text-primary">Mesas</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setAddMesaDialog({ esPersonal: true })}>
              <UserCog size={15} className="mr-1" /> Mesa Personal
            </Button>
            <Button size="sm" onClick={() => setAddMesaDialog({ esPersonal: false })}>
              <Plus size={16} className="mr-1" /> Agregar Mesa
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {mesasNormales.map((mesa) => (
          <MesaCard key={mesa.uuid} mesa={mesa} />
        ))}
      </div>

      {/* Mesas de personal */}
      {mesasPersonales.length > 0 && (
        <>
          <h2 className="text-sm font-display text-muted-foreground mb-3 flex items-center gap-1.5">
            <UserCog size={14} /> Consumo Personal
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {mesasPersonales.map((mesa) => (
              <MesaCard key={mesa.uuid} mesa={mesa} />
            ))}
          </div>
        </>
      )}

      {/* Nueva orden en mesa vacía */}
      {newOrderTable !== null && (
        <NewOrderDialog
          tableNumber={newOrderTable}
          user={user!}
          existingLideres={getLideresForTable(newOrderTable)}
          onClose={() => setNewOrderTable(null)}
          onCreated={() => {
            setNewOrderTable(null);
            fetchAll();
          }}
        />
      )}

      {/* Agregar pedido a mesa ya ocupada */}
      {addOrderToMesa !== null && (
        <NewOrderDialog
          tableNumber={addOrderToMesa.numero}
          user={user!}
          existingLideres={getLideresForTable(addOrderToMesa.numero)}
          onClose={() => setAddOrderToMesa(null)}
          onCreated={() => {
            setAddOrderToMesa(null);
            fetchAll();
          }}
        />
      )}

      {/* Vista de mesa ocupada con split bill */}
      {selectedMesa && (
        <MesaDetailDialog
          mesa={selectedMesa}
          onClose={() => setSelectedMesa(null)}
          onUpdate={fetchAll}
          onNewOrder={() => {
            setSelectedMesa(null);
            setAddOrderToMesa(selectedMesa);
          }}
        />
      )}

      {addMesaDialog && (
        <AddMesaDialog
          esPersonal={addMesaDialog.esPersonal}
          numeroSugerido={sugerirNumero(addMesaDialog.esPersonal)}
          numerosExistentes={mesas.map((m) => m.numero)}
          onClose={() => setAddMesaDialog(null)}
          onConfirm={(numero) => handleCrearMesa(numero, addMesaDialog.esPersonal)}
        />
      )}
    </div>
  );
};

// ── Diálogo para elegir el número de mesa al crearla ──────────────────────────

const AddMesaDialog = ({
  esPersonal,
  numeroSugerido,
  numerosExistentes,
  onClose,
  onConfirm,
}: {
  esPersonal: boolean;
  numeroSugerido: number;
  numerosExistentes: number[];
  onClose: () => void;
  onConfirm: (numero: number) => void;
}) => {
  const [valor, setValor] = useState(String(esPersonal ? numeroSugerido - 900 : numeroSugerido));
  const numeroFinal = esPersonal ? 900 + Number(valor) : Number(valor);
  const yaExiste = numerosExistentes.includes(numeroFinal);
  const esValido = valor.trim() !== "" && Number(valor) > 0 && Number.isInteger(Number(valor));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xs bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-primary">
            {esPersonal ? "Nueva Mesa Personal" : "Nueva Mesa"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {esPersonal ? "Número de personal" : "Número de mesa"}
            </label>
            <Input
              type="number"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              autoFocus
              min={1}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Sugerido: {esPersonal ? numeroSugerido - 900 : numeroSugerido}. Podés usar cualquier número
              (por ejemplo, para reemplazar una mesa física que eliminaste).
            </p>
            {yaExiste && (
              <p className="text-destructive text-xs mt-1">Ya existe una mesa con ese número.</p>
            )}
          </div>
          <Button
            className="w-full"
            disabled={!esValido || yaExiste}
            onClick={() => onConfirm(numeroFinal)}
          >
            Crear
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Dashboard;
