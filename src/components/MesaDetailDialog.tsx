import { useState, useEffect } from "react";
import {
  getPedidosPorMesa,
  cobrarDetalles,
  cancelarPedido,
  type Pedido,
  type Mesa,
} from "@/services/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, User, ChevronDown, ChevronUp, CheckSquare, Square, PlusCircle, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import BoletaModal, { detallesABoleta } from "@/components/BoletaModal";
import AgregarItemsDialog from "@/components/AgregarItemsDialog";
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

interface Props {
  mesa: Mesa;
  onClose: () => void;
  onUpdate: () => void;
  onNewOrder: () => void;
}

interface BoletaPending {
  mesaNumero: number;
  lider?: string;
  mesero?: string;
  items: ReturnType<typeof detallesABoleta>;
  cerrarMesaAlFinalizar: boolean;
}

const MesaDetailDialog = ({ mesa, onClose, onUpdate, onNewOrder }: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [cobrando, setCobrando] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<Pedido | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, Set<string>>>({});
  const [boletaPending, setBoletaPending] = useState<BoletaPending | null>(null);
  const [agregarAPedido, setAgregarAPedido] = useState<Pedido | null>(null);

  const fetchPedidos = async () => {
    setLoading(true);
    try {
      const data = await getPedidosPorMesa(mesa.uuid);
      setPedidos(data);
      if (data.length === 1) setExpanded(data[0].uuid);
      const sel: Record<string, Set<string>> = {};
      data.forEach((p) => {
        sel[p.uuid] = new Set(); // empezar sin nada seleccionado
      });
      setSelectedItems(sel);
    } catch (err) {
      console.error("Error al cargar pedidos de mesa:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPedidos();
  }, [mesa.uuid]);

  const toggleItem = (pedidoUuid: string, detalleUuid: string) => {
    setSelectedItems((prev) => {
      const set = new Set(prev[pedidoUuid] ?? []);
      if (set.has(detalleUuid)) set.delete(detalleUuid);
      else set.add(detalleUuid);
      return { ...prev, [pedidoUuid]: set };
    });
  };

  const handleCobrar = async (pedido: Pedido) => {
    if (cobrando) return;
    const selected = Array.from(selectedItems[pedido.uuid] ?? []);
    if (selected.length === 0) return;

    setCobrando(pedido.uuid);
    try {
      const detalles = pedido.detalles_pedido ?? [];
      const todosNoCobrados = detalles
        .filter((d) => !d.cobrado && d.uuid)
        .map((d) => d.uuid!);
      // ¿Quedan otros pedidos activos en la mesa además de este?
      const otrosPedidosActivos = pedidos.some(
        (p) => p.uuid !== pedido.uuid && (p.detalles_pedido ?? []).some((d) => !d.cobrado)
      );
      const esTodoElPedido = selected.length >= todosNoCobrados.length;
      // Cerrar ESTE pedido apenas se cobran todos sus ítems, sin importar otros clientes
      const cerrarPedido = esTodoElPedido;
      // La mesa se libera solo cuando este era el último pedido con ítems pendientes
      const liberarMesa = esTodoElPedido && !otrosPedidosActivos;

      const boletaItems = detallesABoleta(detalles, selected);

      await cobrarDetalles(selected, pedido.uuid, mesa.uuid, cerrarPedido, liberarMesa);

      setBoletaPending({
        mesaNumero: mesa.numero,
        lider: pedido.cliente_nombre,
        mesero: pedido.profiles?.nombre,
        items: boletaItems,
        cerrarMesaAlFinalizar: liberarMesa,
      });

      onUpdate();
      if (!liberarMesa) {
        await fetchPedidos();
      }
    } catch (err: any) {
      console.error("Error al cobrar:", err);
      toast({
        title: "No se pudo cobrar",
        description: err?.message ?? "Error desconocido. Revisá la consola.",
        variant: "destructive",
      });
    } finally {
      setCobrando(null);
    }
  };

  const handleCancelar = async (pedido: Pedido) => {
    try {
      await cancelarPedido(pedido.uuid, mesa.uuid);
      toast({ title: "Pedido cancelado" });
      setCancelando(null);
      onUpdate();
      const restantes = pedidos.filter((p) => p.uuid !== pedido.uuid);
      if (restantes.length === 0) {
        onClose();
      } else {
        await fetchPedidos();
      }
    } catch (err: any) {
      toast({ title: "Error al cancelar", description: err?.message, variant: "destructive" });
    }
  };

  const totalMesa = pedidos.reduce((s, p) => {
    return (
      s +
      (p.detalles_pedido ?? [])
        .filter((d) => !d.cobrado)
        .reduce((a, d) => a + d.precio_historico * d.cantidad, 0)
    );
  }, 0);

  const getSelectedTotal = (pedido: Pedido) => {
    const sel = selectedItems[pedido.uuid] ?? new Set();
    return (pedido.detalles_pedido ?? [])
      .filter((d) => d.uuid && sel.has(d.uuid))
      .reduce((s, d) => s + d.precio_historico * d.cantidad, 0);
  };

  return (
    <>
      <Dialog open={!boletaPending && !agregarAPedido} onOpenChange={onClose}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">
              Mesa {mesa.numero}
              {mesa.es_personal && (
                <span className="ml-2 text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                  Personal
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : pedidos.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              No hay pedidos activos en esta mesa.
            </p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {pedidos.map((pedido) => {
                const isOpen = expanded === pedido.uuid;
                const detalles = pedido.detalles_pedido ?? [];
                const pendientes = detalles.filter((d) => !d.cobrado);
                const cobrados = detalles.filter((d) => d.cobrado);
                const sel = selectedItems[pedido.uuid] ?? new Set<string>();
                const selectedTotal = getSelectedTotal(pedido);
                const pendienteTotal = pendientes.reduce(
                  (s, d) => s + d.precio_historico * d.cantidad,
                  0
                );

                return (
                  <div key={pedido.uuid} className="border border-border rounded-xl overflow-hidden">
                    {/* Header */}
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/50 transition-all"
                      onClick={() => setExpanded(isOpen ? null : pedido.uuid)}
                    >
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-muted-foreground" />
                        <span className="font-medium text-sm text-foreground">
                          {pedido.cliente_nombre ?? "Sin nombre"}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${statusClass[pedido.estado]}`}
                        >
                          {statusLabel[pedido.estado]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-primary font-semibold text-sm">
                          ${pendienteTotal.toFixed(2)}
                        </span>
                        {isOpen ? (
                          <ChevronUp size={14} className="text-muted-foreground" />
                        ) : (
                          <ChevronDown size={14} className="text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Detalle colapsable */}
                    {isOpen && (
                      <div className="border-t border-border px-3 pb-3 pt-2 space-y-1.5">
                        {pendientes.length > 0 && (
                          <>
                            <p className="text-xs text-muted-foreground mb-1">
                              Seleccioná los ítems a cobrar:
                            </p>
                            {pendientes.map((d, i) => {
                              const checked = d.uuid ? sel.has(d.uuid) : false;
                              return (
                                <div
                                  key={d.uuid ?? i}
                                  className="flex items-start gap-2 cursor-pointer group"
                                  onClick={() => d.uuid && toggleItem(pedido.uuid, d.uuid)}
                                >
                                  <div className="mt-0.5 shrink-0 text-primary">
                                    {checked ? (
                                      <CheckSquare size={15} />
                                    ) : (
                                      <Square
                                        size={15}
                                        className="text-muted-foreground group-hover:text-primary transition-all"
                                      />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex justify-between text-sm">
                                      <span className={`text-foreground ${!checked ? "opacity-60" : ""}`}>
                                        {d.cantidad}×{" "}
                                        {d.productos?.nombre ?? d.nombre_extra ?? "Ítem extra"}
                                      </span>
                                      <span className="text-muted-foreground text-xs">
                                        ${(d.precio_historico * d.cantidad).toFixed(2)}
                                      </span>
                                    </div>
                                    {d.notas && (
                                      <p className="text-xs text-amber-400 italic">⚠ {d.notas}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}

                        {cobrados.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <p className="text-xs text-muted-foreground mb-1">Ya cobrado:</p>
                            {cobrados.map((d, i) => (
                              <div
                                key={d.uuid ?? `cobrado_${i}`}
                                className="flex justify-between text-xs text-muted-foreground/40 line-through"
                              >
                                <span>
                                  {d.cantidad}×{" "}
                                  {d.productos?.nombre ?? d.nombre_extra ?? "Extra"}
                                </span>
                                <span>${(d.precio_historico * d.cantidad).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="pt-2 border-t border-border flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAgregarAPedido(pedido)}
                            className="shrink-0"
                          >
                            <PlusCircle size={13} className="mr-1" /> Agregar
                          </Button>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0 text-destructive border-destructive/40 hover:bg-destructive/10"
                              onClick={() => setCancelando(pedido)}
                            >
                              <XCircle size={13} className="mr-1" /> Cancelar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleCobrar(pedido)}
                            disabled={cobrando === pedido.uuid || sel.size === 0}
                          >
                            {cobrando === pedido.uuid ? (
                              <Loader2 className="animate-spin" size={14} />
                            ) : sel.size > 0 ? (
                              `Cobrar $${selectedTotal.toFixed(2)} (${sel.size} ítem${sel.size !== 1 ? "s" : ""})`
                            ) : (
                              "Seleccioná ítems"
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t border-border pt-3 flex items-center justify-between">
            <div>
              {pedidos.length > 0 && (
                <>
                  <p className="text-muted-foreground text-xs">Total pendiente</p>
                  <p className="text-xl font-display text-primary">${totalMesa.toFixed(2)}</p>
                </>
              )}
            </div>
            <Button size="sm" onClick={onNewOrder}>
              + Agregar pedido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {agregarAPedido && (
        <AgregarItemsDialog
          pedidoUuid={agregarAPedido.uuid}
          clienteNombre={agregarAPedido.cliente_nombre}
          mesaNumero={mesa.numero}
          onClose={() => setAgregarAPedido(null)}
          onAdded={() => {
            setAgregarAPedido(null);
            fetchPedidos();
            onUpdate();
          }}
        />
      )}

      {cancelando && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4 text-center">
            <XCircle size={36} className="mx-auto text-destructive" />
            <p className="font-display text-lg text-primary">¿Cancelar pedido?</p>
            <p className="text-muted-foreground text-sm">
              Se cancelará el pedido de{" "}
              <span className="text-foreground font-medium">
                {cancelando.cliente_nombre ?? "este cliente"}
              </span>
              . Los ítems no serán cobrados.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCancelando(null)}>
                Volver
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleCancelar(cancelando)}
              >
                Sí, cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {boletaPending && (
        <BoletaModal
          mesaNumero={boletaPending.mesaNumero}
          lider={boletaPending.lider}
          mesero={boletaPending.mesero}
          items={boletaPending.items}
          onClose={() => {
            const cierraMesa = boletaPending.cerrarMesaAlFinalizar;
            setBoletaPending(null);
            if (cierraMesa) onClose();
          }}
        />
      )}
    </>
  );
};

export default MesaDetailDialog;
