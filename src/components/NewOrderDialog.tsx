import { useState, useEffect } from "react";
import { type User } from "@/lib/store";
import { getProductos, createPedido, createProducto, type Producto, type NuevoDetalle, type DestinoImpresion } from "@/services/db";
import { imprimirComandasDeItems, type ItemParaComanda } from "@/services/print";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Trash2, Loader2, User as UserIcon, PlusCircle, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  tableNumber: number;
  user: User;
  existingLideres?: string[];
  onClose: () => void;
  onCreated: () => void;
}

const NewOrderDialog = ({ tableNumber, user, existingLideres = [], onClose, onCreated }: Props) => {
  const { toast } = useToast();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);
  const [liderNombre, setLiderNombre] = useState("");
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
      .catch((err) => console.error("Error al cargar productos:", err))
      .finally(() => setLoadingProductos(false));
  }, []);

  const CATEGORY_ORDER = ["Bebidas alcoholicas","Bebidas sin alcohol","Shots","Café","Extras bebidas","Entrada","Plato fuerte","Bocadillos","Postre","Extras comidas"];
  const categories = [...new Set(productos.map((p) => p.categoria))].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const addItem = (producto: Producto) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.producto.uuid === producto.uuid);
      if (existing) {
        return prev.map((i) =>
          i.producto.uuid === producto.uuid ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, { producto, cantidad: 1, notas: "" }];
    });
  };

  const updateQty = (productoUuid: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.producto.uuid === productoUuid ? { ...i, cantidad: Math.max(0, i.cantidad + delta) } : i
        )
        .filter((i) => i.cantidad > 0)
    );
  };

  const updateNotas = (productoUuid: string, notas: string) => {
    setItems((prev) =>
      prev.map((i) => (i.producto.uuid === productoUuid ? { ...i, notas } : i))
    );
  };

  const [savingExtra, setSavingExtra] = useState(false);

  const addExtraItem = async () => {
    const precio = parseFloat(extraForm.precio);
    if (!extraForm.nombre.trim() || isNaN(precio) || precio <= 0) return;
    setSavingExtra(true);
    try {
      // Save to productos DB so all waiters can see it
      const destino: DestinoImpresion = activeCategory === "Extras Bebidas" ? "barra" : "cocina";
      const nuevo = await createProducto({
        nombre: extraForm.nombre.trim(),
        precio,
        categoria: activeCategory, // "Extras Bebidas" or "Extras Comidas"
        disponible: true,
        destino_impresion: destino,
      });
      // Refresh products list
      const updated = await getProductos();
      setProductos(updated);
      // Add to cart as regular item
      addItem(nuevo);
      setExtraForm({ nombre: "", precio: "", notas: "" });
      setShowExtraForm(false);
    } catch (err: any) {
      setError(err?.message ?? "Error al guardar el ítem.");
    } finally {
      setSavingExtra(false);
    }
  };

  const updateExtraQty = (id: string, delta: number) => {
    setExtraItems((prev) =>
      prev
        .map((e) => (e.id === id ? { ...e, cantidad: Math.max(0, e.cantidad + delta) } : e))
        .filter((e) => e.cantidad > 0)
    );
  };

  const totalRegular = items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0);
  const totalExtra = extraItems.reduce((s, e) => s + e.precio * e.cantidad, 0);
  const total = totalRegular + totalExtra;
  const totalItems = items.length + extraItems.length;

  const liderError =
    liderNombre.trim() &&
    existingLideres.some(
      (n) => n.toLowerCase() === liderNombre.trim().toLowerCase()
    )
      ? `"${liderNombre.trim()}" ya tiene un pedido en esta mesa`
      : null;

  const handleCreate = async () => {
    if (totalItems === 0 || submitting) return;
    if (!liderNombre.trim()) {
      setError("El nombre del líder es obligatorio.");
      return;
    }
    if (liderError) {
      setError(liderError);
      return;
    }
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
      await createPedido(tableNumber, detalles, user.id, liderNombre.trim());

      // Imprimir comandas: Comida/Extras Comida -> Cocina, Bebidas/Extras Bebidas -> Bar
      const itemsParaComanda: ItemParaComanda[] = items.map((i) => ({
        cantidad: i.cantidad,
        nombre: i.producto.nombre,
        notas: i.notas.trim() || undefined,
        destino: i.producto.destino_impresion ?? "cocina",
      }));
      imprimirComandasDeItems(itemsParaComanda, tableNumber, liderNombre.trim(), user.name)
        .then((results) => {
          const fallo = results.find((r) => !r.success);
          if (fallo) toast({ title: "No se pudo imprimir la comanda", description: fallo.error, variant: "destructive" });
        })
        .catch(() => {});

      onCreated();
    } catch (err: any) {
      console.error("Error al crear pedido:", err);
      setError(err?.message ?? "Error al crear el pedido.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-primary">
            Nuevo Pedido — Mesa {tableNumber}
          </DialogTitle>
        </DialogHeader>

        {loadingProductos ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <>
            {/* Líder (obligatorio) */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <UserIcon size={15} className="text-muted-foreground shrink-0" />
                <Input
                  placeholder="Nombre del líder de grupo *"
                  value={liderNombre}
                  onChange={(e) => { setLiderNombre(e.target.value); setError(null); }}
                  className={`h-8 text-sm ${liderError ? "border-destructive" : ""}`}
                />
              </div>
              {liderError && (
                <p className="text-destructive text-xs pl-6">{liderError}</p>
              )}
            </div>

            {/* Categories — siempre visible, no scrollea */}
            <div className="flex gap-2 overflow-x-auto pb-1 shrink-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Zona scrolleable: productos + carrito + extras + error */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-3">

            {/* Products grid */}
            <div className="grid grid-cols-2 gap-2 pr-1">
              {productos
                .filter((p) => p.categoria === activeCategory)
                .map((producto) => {
                  const inCart = items.find((i) => i.producto.uuid === producto.uuid);
                  return (
                    <button
                      key={producto.uuid}
                      onClick={() => addItem(producto)}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        inCart
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary/50 hover:border-primary/30"
                      }`}
                    >
                      <p className="text-sm font-medium text-foreground">{producto.nombre}</p>
                      <p className="text-primary font-semibold text-sm">${producto.precio}</p>
                      {inCart && (
                        <p className="text-xs text-muted-foreground mt-0.5">× {inCart.cantidad}</p>
                      )}
                    </button>
                  );
                })}
            </div>

            {/* Cart */}
            {(items.length > 0 || extraItems.length > 0) && (
              <div className="border-t border-border pt-3 space-y-2">
                {items.map((item) => {
                  const notaOpen = notaAbierta === item.producto.uuid;
                  return (
                    <div key={item.producto.uuid} className="rounded-lg bg-secondary/40 border border-border/60 px-3 py-2 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground font-medium flex-1 truncate">{item.producto.nombre}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => updateQty(item.producto.uuid, -1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary text-muted-foreground hover:text-foreground active:scale-95">
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-foreground text-sm font-medium">{item.cantidad}</span>
                          <button onClick={() => updateQty(item.producto.uuid, 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary text-muted-foreground hover:text-foreground active:scale-95">
                            <Plus size={14} />
                          </button>
                          <span className="w-14 text-right text-primary font-semibold text-sm">
                            ${(item.producto.precio * item.cantidad).toFixed(2)}
                          </span>
                          <button onClick={() => updateQty(item.producto.uuid, -item.cantidad)} className="w-8 h-8 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 active:scale-95">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {notaOpen ? (
                        <input
                          type="text"
                          autoFocus
                          placeholder="Ej: sin hielo, sin sal, bien cocido…"
                          value={item.notas}
                          onChange={(e) => updateNotas(item.producto.uuid, e.target.value)}
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
                      <button onClick={() => updateExtraQty(e.id, -1)} className="p-1 rounded bg-secondary text-muted-foreground hover:text-foreground">
                        <Minus size={12} />
                      </button>
                      <span className="w-5 text-center text-foreground text-xs">{e.cantidad}</span>
                      <button onClick={() => updateExtraQty(e.id, 1)} className="p-1 rounded bg-secondary text-muted-foreground hover:text-foreground">
                        <Plus size={12} />
                      </button>
                      <button onClick={() => setExtraItems((prev) => prev.filter((x) => x.id !== e.id))} className="p-1 rounded text-destructive hover:bg-destructive/10">
                        <Trash2 size={12} />
                      </button>
                      <span className="w-14 text-right text-primary font-medium text-xs">
                        ${(e.precio * e.cantidad).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Ítem extra form — solo en Extras Bebidas / Extras Comidas */}
            {(activeCategory === "Extras Bebidas" || activeCategory === "Extras Comidas") && (
              showExtraForm ? (
              <div className="border border-amber-500/30 rounded-lg p-3 space-y-2 bg-amber-500/5">
                <p className="text-xs text-amber-400 font-medium">
                  Nuevo ítem en {activeCategory} — se guardará en el menú para todos
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nombre del ítem"
                    value={extraForm.nombre}
                    onChange={(e) => setExtraForm({ ...extraForm, nombre: e.target.value })}
                    className="flex-1 text-sm bg-secondary border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                  />
                  <input
                    type="number"
                    placeholder="Precio"
                    value={extraForm.precio}
                    onChange={(e) => setExtraForm({ ...extraForm, precio: e.target.value })}
                    className="w-24 text-sm bg-secondary border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addExtraItem} disabled={!extraForm.nombre.trim() || !extraForm.precio || savingExtra}>
                    {savingExtra && <Loader2 className="animate-spin mr-1" size={13} />}
                    Agregar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowExtraForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowExtraForm(true)}
                className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-all self-start"
              >
                <PlusCircle size={13} />
                Agregar nuevo ítem a {activeCategory}
              </button>
            ) )}

            {/* Error */}
            {error && (
              <p className="text-destructive text-xs bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            </div>{/* fin zona scrolleable */}

            {/* Footer — siempre visible */}
            <div className="flex items-center justify-between pt-2 border-t border-border shrink-0">
              <div>
                <p className="text-muted-foreground text-xs">Total</p>
                <p className="text-xl font-display text-primary">${total.toFixed(2)}</p>
              </div>
              <Button
                onClick={handleCreate}
                disabled={totalItems === 0 || submitting || !liderNombre.trim() || !!liderError}
              >
                {submitting && <Loader2 className="animate-spin mr-2" size={16} />}
                Crear Pedido
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewOrderDialog;
