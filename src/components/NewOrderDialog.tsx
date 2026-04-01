import { useState } from "react";
import { store, Product, OrderItem, User } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Trash2 } from "lucide-react";

interface Props {
  tableNumber: number;
  user: User;
  onClose: () => void;
  onCreated: () => void;
}

const NewOrderDialog = ({ tableNumber, user, onClose, onCreated }: Props) => {
  const products = store.getProducts();
  const categories = [...new Set(products.map((p) => p.category))];
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const [items, setItems] = useState<OrderItem[]>([]);

  const addItem = (product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.product.id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const total = items.reduce((s, i) => s + i.product.price * i.quantity, 0);

  const handleCreate = () => {
    if (items.length === 0) return;
    store.createOrder(tableNumber, items, user.id, user.name);
    onCreated();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-primary">
            Nuevo Pedido — Mesa {tableNumber}
          </DialogTitle>
        </DialogHeader>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2">
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

        {/* Products grid */}
        <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {products
            .filter((p) => p.category === activeCategory)
            .map((product) => {
              const inCart = items.find((i) => i.product.id === product.id);
              return (
                <button
                  key={product.id}
                  onClick={() => addItem(product)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    inCart
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/50 hover:border-primary/30"
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">{product.name}</p>
                  <p className="text-primary font-semibold text-sm">${product.price}</p>
                  {inCart && (
                    <p className="text-xs text-muted-foreground mt-1">× {inCart.quantity}</p>
                  )}
                </button>
              );
            })}
        </div>

        {/* Cart summary */}
        {items.length > 0 && (
          <div className="border-t border-border pt-3 space-y-2 max-h-40 overflow-y-auto">
            {items.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground flex-1">{item.product.name}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(item.product.id, -1)} className="p-1 rounded bg-secondary text-muted-foreground hover:text-foreground">
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center text-foreground">{item.quantity}</span>
                  <button onClick={() => updateQty(item.product.id, 1)} className="p-1 rounded bg-secondary text-muted-foreground hover:text-foreground">
                    <Plus size={14} />
                  </button>
                  <button onClick={() => updateQty(item.product.id, -item.quantity)} className="p-1 rounded text-destructive hover:bg-destructive/10">
                    <Trash2 size={14} />
                  </button>
                  <span className="w-16 text-right text-primary font-medium">
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <p className="text-muted-foreground text-xs">Total</p>
            <p className="text-xl font-display text-primary">${total.toFixed(2)}</p>
          </div>
          <Button onClick={handleCreate} disabled={items.length === 0}>
            Crear Pedido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewOrderDialog;
