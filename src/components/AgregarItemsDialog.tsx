import { useState, useEffect } from "react";
import { getProductos, agregarDetallesAPedido, type Producto, type NuevoDetalle } from "@/services/db";
import { imprimirComandasDeItems, type ItemParaComanda } from "@/services/print";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Trash2, Loader2, PlusCircle, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  producto: Producto;
  cantidad: number;
  notas: string;
}

interface ExtraItem {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  notas: string;
}

interface Props {
  pedidoUuid: string;
  clienteNombre?: string;
  mesaNumero: number;
  onClose: () => void;
  onAdded: () => void;
}

const AgregarItemsDialog = ({ pedidoUuid, clienteNombre, mesaNumero, onClose, onAdded }: Props) => {
  const { toast } = useToast();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [extraForm, setExtraForm] = useState({ nombre: "", precio: "", notas: "" });
  const [notaAbierta, setNotaAbierta] = useState<string | null>(null);

  useEffect(() => {
    getProductos()
      .then((data) => {
        setProductos(data);
        if (data.length > 0) setActiveCategory(data[0].categoria);
      })
      .finally(() => setLoadingProductos(false));
  }, []);

  const categories = [...new Set(productos.map((p) => p.categoria))];

  const addItem = (producto: Producto) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.producto.uuid === producto.uuid);
      if (existing) return prev.map((i) => i.producto.uuid === producto.uuid ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { producto, cantidad: 1, notas: "" }];
    });
  };

  const updateQty = (uuid: string, delta: number) => {
    setItems((prev) =>
      prev.map((i) => i.producto.uuid === uuid ? { ...i, cantidad: Math.max(0, i.cantidad + delta) } : i)
          .filter((i) => i.cantidad > 0)
    );
  };

  const addExtraItem = () => {
    const precio = parseFloat(extraForm.precio);
    if (!extraForm.nombre.trim() || isNaN(precio) || precio <= 0) return;
    setExtraItems((prev) => [...prev, { id: crypto.randomUUID(), nombre: extraForm.nombre.trim(), precio, cantidad: 1, notas: extraForm.notas.trim() }]);
    setExtraForm({ nombre: "", precio: "", notas: "" });
    setShowExtraForm(false);
  };

  const totalItems = items.length + extraItems.length;
  const total =
    items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0) +
    extraItems.reduce((s, e) => s + e.precio * e.cantidad, 0);

  const handleAgregar = async () => {
    if (totalItems === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const detalles: NuevoDetalle[] = [
        ...items.flatMap((i) =>
          Array.from({ length: i.cantidad }, () => ({
            producto_id: i.producto.uuid,
            cantidad: 1,
            precio_historico: i.producto.precio,
            notas: i.notas.trim() || undefined,
          }))
        ),
        ...extraItems.flatMap((e) =>
          Array.from({ length: e.cantidad }, () => ({
            producto_id: null as null,
            nombre_extra: e.nombre,
            cantidad: 1,
            precio_historico: e.precio,
            notas: e.notas || undefined,
          }))
        ),
      ];
      await agregarDetallesAPedido(pedidoUuid, detalles);

      // Imprimir comanda solo de los ítems recién agregados
      const itemsParaComanda: ItemParaComanda[] = items.map((i) => ({
        cantidad: i.cantidad,
        nombre: i.producto.nombre,
        notas: i.notas.trim() || undefined,
        destino: i.producto.destino_impresion ?? "cocina",
      }));
      imprimirComandasDeItems(itemsParaComanda, mesaNumero, clienteNombre)
        .then((results) => {
          const fallo = results.find((r) => !r.success);
          if (fallo) toast({ title: "No se pudo imprimir la comanda", description: fallo.error, variant: "destructive" });
        })
        .catch(() => {});

      onAdded();
    } catch (err: any) {
      setError(err?.message ?? "Error al agregar ítems.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-primary">
            Agregar ítems — {clienteNombre ?? "Mesa " + mesaNumero}
          </DialogTitle>
        </DialogHeader>

        {loadingProductos ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
        ) : (
          <>
            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Products */}
            <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 min-h-0 pr-1">
              {productos.filter((p) => p.categoria === activeCategory).map((producto) => {
                const inCart = items.find((i) => i.producto.uuid === producto.uuid);
                return (
                  <button key={producto.uuid} onClick={() => addItem(producto)}
                    className={`text-left p-3 rounded-lg border transition-all ${inCart ? "border-primary bg-primary/10" : "border-border bg-secondary/50 hover:border-primary/30"}`}>
                    <p className="text-sm font-medium text-foreground">{producto.nombre}</p>
                    <p className="text-primary font-semibold text-sm">${producto.precio}</p>
                    {inCart && <p className="text-xs text-muted-foreground mt-0.5">× {inCart.cantidad}</p>}
                  </button>
                );
              })}
            </div>

            {/* Cart */}
            {(items.length > 0 || extraItems.length > 0) && (
              <div className="border-t border-border pt-3 space-y-2 max-h-36 overflow-y-auto">
                {items.map((item) => {
                  const notaOpen = notaAbierta === item.producto.uuid;
                  return (
                    <div key={item.producto.uuid} className="rounded-lg bg-secondary/40 border border-border/60 px-3 py-2 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground font-medium flex-1 truncate">{item.producto.nombre}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => updateQty(item.producto.uuid, -1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary text-muted-foreground hover:text-foreground active:scale-95"><Minus size={14} /></button>
                          <span className="w-6 text-center text-sm font-medium">{item.cantidad}</span>
                          <button onClick={() => updateQty(item.producto.uuid, 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary text-muted-foreground hover:text-foreground active:scale-95"><Plus size={14} /></button>
                          <span className="w-14 text-right text-primary text-sm font-semibold">${(item.producto.precio * item.cantidad).toFixed(2)}</span>
                          <button onClick={() => updateQty(item.producto.uuid, -item.cantidad)} className="w-8 h-8 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 active:scale-95"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      {notaOpen ? (
                        <input
                          type="text"
                          autoFocus
                          placeholder="Ej: sin hielo, sin sal, bien cocido…"
                          value={item.notas}
                          onChange={(e) => setItems((prev) => prev.map((i) => i.producto.uuid === item.producto.uuid ? { ...i, notas: e.target.value } : i))}
                          onBlur={() => { if (!item.notas) setNotaAbierta(null); }}
                          className="w-full text-sm bg-background border border-amber-500/50 rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber-500"
                        />
                      ) : (
                        <button
                          onClick={() => setNotaAbierta(item.producto.uuid)}
                          className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5 w-full text-left transition-all ${
                            item.notas
                              ? "bg-amber-500/15 border border-amber-500/30 text-amber-400"
                              : "bg-secondary/60 border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-border"
                          }`}
                        >
                          <MessageSquare size={12} />
                          {item.notas || "Agregar nota (sin hielo, sin sal…)"}
                        </button>
                      )}
                    </div>
                  );
                })}
                {extraItems.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm">
                    <span className="text-amber-400 flex-1 truncate">✦ {e.nombre}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => setExtraItems((prev) => prev.map((x) => x.id === e.id ? { ...x, cantidad: Math.max(0, x.cantidad - 1) } : x).filter((x) => x.cantidad > 0))} className="p-1 rounded bg-secondary text-muted-foreground hover:text-foreground"><Minus size={12} /></button>
                      <span className="w-5 text-center text-xs">{e.cantidad}</span>
                      <button onClick={() => setExtraItems((prev) => prev.map((x) => x.id === e.id ? { ...x, cantidad: x.cantidad + 1 } : x))} className="p-1 rounded bg-secondary text-muted-foreground hover:text-foreground"><Plus size={12} /></button>
                      <button onClick={() => setExtraItems((prev) => prev.filter((x) => x.id !== e.id))} className="p-1 rounded text-destructive hover:bg-destructive/10"><Trash2 size={12} /></button>
                      <span className="w-14 text-right text-primary text-xs font-medium">${(e.precio * e.cantidad).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Extra form */}
            {showExtraForm ? (
              <div className="border border-amber-500/30 rounded-lg p-3 space-y-2 bg-amber-500/5">
                <p className="text-xs text-amber-400 font-medium">Ítem extra</p>
                <div className="flex gap-2">
                  <input type="text" placeholder="Nombre" value={extraForm.nombre} onChange={(e) => setExtraForm({ ...extraForm, nombre: e.target.value })}
                    className="flex-1 text-sm bg-secondary border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50" />
                  <input type="number" placeholder="Precio" value={extraForm.precio} onChange={(e) => setExtraForm({ ...extraForm, precio: e.target.value })}
                    className="w-24 text-sm bg-secondary border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addExtraItem} disabled={!extraForm.nombre.trim() || !extraForm.precio}>Agregar</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowExtraForm(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowExtraForm(true)} className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 self-start">
                <PlusCircle size={13} /> Ítem extra (precio manual)
              </button>
            )}

            {error && <p className="text-destructive text-xs bg-destructive/10 rounded px-3 py-2">{error}</p>}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <p className="text-muted-foreground text-xs">A agregar</p>
                <p className="text-xl font-display text-primary">${total.toFixed(2)}</p>
              </div>
              <Button onClick={handleAgregar} disabled={totalItems === 0 || submitting}>
                {submitting && <Loader2 className="animate-spin mr-2" size={16} />}
                Agregar al pedido
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AgregarItemsDialog;
