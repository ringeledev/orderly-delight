import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getProductos,
  createProducto,
  updateProducto,
  deleteProducto,
  type Producto,
} from "@/services/db";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Loader2, ToggleLeft, ToggleRight } from "lucide-react";

const Menu = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [products, setProducts] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const fetchProductos = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getProductos(!showAll);
      setProducts(data);
    } catch (err: any) {
      console.error("Error al cargar productos:", err);
      setLoadError(err?.message ?? "Error desconocido al cargar el menú.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductos();
  }, [showAll]);

  const categories = [...new Set(products.map((p) => p.categoria))];

  const handleSave = async (producto: Producto) => {
    try {
      if (isNew) {
        await createProducto({
          nombre: producto.nombre,
          precio: producto.precio,
          categoria: producto.categoria,
          disponible: producto.disponible,
        });
      } else {
        await updateProducto(producto.uuid, {
          nombre: producto.nombre,
          precio: producto.precio,
          categoria: producto.categoria,
          disponible: producto.disponible,
        });
      }
      setEditingProduct(null);
      await fetchProductos();
    } catch (err: any) {
      console.error("Error al guardar producto:", err);
      throw err;
    }
  };

  const handleDelete = async (producto: Producto) => {
    if (!confirm(`¿Eliminar "${producto.nombre}"?`)) return;
    try {
      await deleteProducto(producto.uuid);
      setProducts((prev) => prev.filter((p) => p.uuid !== producto.uuid));
    } catch (err: any) {
      // FK constraint: product has orders, disable instead
      const esFKError =
        err?.code === "23503" ||
        (err?.message ?? "").includes("foreign key") ||
        (err?.message ?? "").includes("violates");
      if (esFKError) {
        const desactivar = confirm(
          `"${producto.nombre}" tiene pedidos registrados y no puede eliminarse.\n\n¿Querés deshabilitarlo en su lugar? No aparecerá en nuevos pedidos.`
        );
        if (desactivar) {
          await updateProducto(producto.uuid, { disponible: false });
          setProducts((prev) =>
            prev.map((p) => (p.uuid === producto.uuid ? { ...p, disponible: false } : p))
          );
        }
      } else {
        alert("Error al eliminar el producto.");
        console.error(err);
      }
    }
  };

  const handleToggleDisponible = async (producto: Producto) => {
    try {
      await updateProducto(producto.uuid, { disponible: !producto.disponible });
      setProducts((prev) =>
        prev.map((p) =>
          p.uuid === producto.uuid ? { ...p, disponible: !p.disponible } : p
        )
      );
    } catch (err) {
      console.error("Error al actualizar disponibilidad:", err);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div>
      {loadError && (
        <div className="mb-4 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
          <p className="font-medium">No se pudo cargar el menú</p>
          <p className="text-xs mt-0.5">{loadError}</p>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display text-primary">Menú</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-all"
            >
              {showAll ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              {showAll ? "Todos" : "Solo disponibles"}
            </button>
          )}
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => {
                setIsNew(true);
                setEditingProduct({
                  uuid: "",
                  nombre: "",
                  precio: 0,
                  categoria: categories[0] ?? "Comida",
                  disponible: true,
                });
              }}
            >
              <Plus size={16} className="mr-1" /> Agregar
            </Button>
          )}
        </div>
      </div>

      {categories.map((cat) => (
        <div key={cat} className="mb-6">
          <h2 className="font-display text-foreground text-lg mb-3">{cat}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products
              .filter((p) => p.categoria === cat)
              .map((product) => (
                <div
                  key={product.uuid}
                  className={`flex items-center justify-between p-3 bg-card border rounded-xl transition-all ${
                    product.disponible
                      ? "border-border"
                      : "border-dashed border-border opacity-50"
                  }`}
                >
                  <div>
                    <p className="text-foreground font-medium text-sm">{product.nombre}</p>
                    <p className="text-primary font-semibold">€{product.precio}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleToggleDisponible(product)}
                        title={product.disponible ? "Deshabilitar" : "Habilitar"}
                        className={`p-2 rounded-lg transition-all ${
                          product.disponible
                            ? "text-muted-foreground hover:text-foreground hover:bg-secondary"
                            : "text-primary hover:bg-primary/10"
                        }`}
                      >
                        {product.disponible ? (
                          <ToggleRight size={14} />
                        ) : (
                          <ToggleLeft size={14} />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setIsNew(false);
                          setEditingProduct(product);
                        }}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(product)}
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

// ── Product Dialog ────────────────────────────────────────────────────────────

const ProductDialog = ({
  product,
  isNew,
  categories,
  onSave,
  onClose,
}: {
  product: Producto;
  isNew: boolean;
  categories: string[];
  onSave: (p: Producto) => Promise<void>;
  onClose: () => void;
}) => {
  const [form, setForm] = useState<Producto>(product);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const payload = { ...form, categoria: form.categoria || "General" };
    if (!payload.nombre.trim()) { setError("El nombre es obligatorio."); return; }
    if (!payload.precio || payload.precio <= 0) { setError("El precio debe ser mayor a 0."); return; }
    setError(null);
    setSaving(true);
    try {
      await onSave(payload);
    } catch (err: any) {
      setError(err?.message ?? "Error al guardar. Revisá la consola.");
    } finally {
      setSaving(false);
    }
  };

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
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <Input
            type="number"
            placeholder="Precio"
            value={form.precio || ""}
            onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })}
          />
          <select
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">— Categoría —</option>
            <option value="Comida">Comida</option>
            <option value="Bebidas">Bebidas</option>
            <option value="Extras Bebidas">Extras Bebidas</option>
            <option value="Extras Comidas">Extras Comidas</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={form.disponible}
              onChange={(e) => setForm({ ...form, disponible: e.target.checked })}
              className="accent-primary"
            />
            Disponible
          </label>
          {error && (
            <p className="text-destructive text-xs bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full"
          >
            {saving && <Loader2 className="animate-spin mr-2" size={16} />}
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Menu;
