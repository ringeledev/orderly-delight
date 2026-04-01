import { useState } from "react";
import { store, Product } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2 } from "lucide-react";

const Menu = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>(store.getProducts());
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isNew, setIsNew] = useState(false);

  const categories = [...new Set(products.map((p) => p.category))];
  const isAdmin = user?.role === "admin";

  const refresh = () => setProducts([...store.getProducts()]);

  const handleSave = (product: Product) => {
    const all = store.getProducts();
    if (isNew) {
      all.push({ ...product, id: `p_${Date.now()}` });
    } else {
      const idx = all.findIndex((p) => p.id === product.id);
      if (idx >= 0) all[idx] = product;
    }
    store.saveProducts(all);
    refresh();
    setEditingProduct(null);
  };

  const handleDelete = (id: string) => {
    store.saveProducts(store.getProducts().filter((p) => p.id !== id));
    refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display text-primary">Menú</h1>
        {isAdmin && (
          <Button
            size="sm"
            onClick={() => {
              setIsNew(true);
              setEditingProduct({ id: "", name: "", price: 0, category: categories[0] || "Comida" });
            }}
          >
            <Plus size={16} className="mr-1" /> Agregar
          </Button>
        )}
      </div>

      {categories.map((cat) => (
        <div key={cat} className="mb-6">
          <h2 className="font-display text-foreground text-lg mb-3">{cat}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products
              .filter((p) => p.category === cat)
              .map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-card border border-border rounded-xl">
                  <div>
                    <p className="text-foreground font-medium text-sm">{product.name}</p>
                    <p className="text-primary font-semibold">${product.price}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setIsNew(false); setEditingProduct(product); }}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}

      {editingProduct && (
        <ProductDialog
          product={editingProduct}
          isNew={isNew}
          categories={categories}
          onSave={handleSave}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
};

const ProductDialog = ({
  product,
  isNew,
  categories,
  onSave,
  onClose,
}: {
  product: Product;
  isNew: boolean;
  categories: string[];
  onSave: (p: Product) => void;
  onClose: () => void;
}) => {
  const [form, setForm] = useState(product);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-primary">
            {isNew ? "Nuevo Producto" : "Editar Producto"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            type="number"
            placeholder="Precio"
            value={form.price || ""}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
          />
          <Input
            placeholder="Categoría"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            list="categories"
          />
          <datalist id="categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Button onClick={() => onSave(form)} disabled={!form.name || !form.price} className="w-full">
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Menu;
