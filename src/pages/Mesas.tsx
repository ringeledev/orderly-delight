import { useState, useEffect } from "react";
import { store, Product } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";

interface Mesa {
  id: string;
  number: number;
  status: "Disponible" | "Ocupada";
}

// Estructura que requiere tu sistema de pedidos
interface Pedido {
  id: string;
  tableNumber: number;
  items: { product: Product; quantity: number }[];
  total: number;
  status: "Pendiente" | "En preparación" | "Entregado" | "Pagado";
  timestamp: number;
}

const Mesas = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin"; 

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [products] = useState<Product[]>(store.getProducts());
  const [activeCategory, setActiveCategory] = useState<string>("Comida");
  const [pedidoActual, setPedidoActual] = useState<{ [productId: string]: number }>({});

  const categories = products.length > 0 
    ? [...new Set(products.map((p) => p.category))] 
    : ["Comida", "Entrada", "Bebida", "Postre"];

  useEffect(() => {
    const mesasGuardadas = (store as any).getTables?.() || [];
    if (mesasGuardadas.length > 0) {
      setMesas(mesasGuardadas);
    } else {
      const iniciales: Mesa[] = Array.from({ length: 12 }, (_, i) => ({
        id: `m_${i + 1}`,
        number: i + 1,
        status: "Disponible",
      }));
      setMesas(iniciales);
    }
    
    if (categories.length > 0) {
      setActiveCategory(categories[0]);
    }
  }, []);

  const actualizarMesas = (nuevasMesas: Mesa[]) => {
    setMesas(nuevasMesas);
    if ((store as any).saveTables) {
      (store as any).saveTables(nuevasMesas);
    } else {
      localStorage.setItem("sazon_latino_mesas", JSON.stringify(nuevasMesas));
    }
  };

  const handleAddMesa = () => {
    if (!isAdmin) return;
    const nextNumber = mesas.length > 0 ? Math.max(...mesas.map((m) => m.number)) + 1 : 1;
    const newMesa: Mesa = {
      id: `m_${Date.now()}`,
      number: nextNumber,
      status: "Disponible",
    };
    actualizarMesas([...mesas, newMesa]);
  };

  const handleDeleteMesa = (id: string, number: number) => {
    if (!isAdmin) return;
    if (confirm(`¿Estás seguro de que deseas eliminar la Mesa ${number}?`)) {
      actualizarMesas(mesas.filter((mesa) => mesa.id !== id));
    }
  };

  const handleOpenPedido = (mesa: Mesa) => {
    setSelectedMesa(mesa);
    setPedidoActual({}); 
  };

  const handleAddItem = (productId: string) => {
    setPedidoActual((prev) => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }));
  };

  const calcularTotal = () => {
    return Object.entries(pedidoActual).reduce((sum, [id, qty]) => {
      const prod = products.find((p) => p.id === id);
      return sum + (prod ? prod.price * qty : 0);
    }, 0);
  };

  // 💾 AQUÍ SE GENERA ALMACENAMIENTO DE LA ORDEN EN EL STORE GLOBAL
  const handleCrearPedidoFinal = () => {
    if (!selectedMesa) return;

    // 1. Mapeamos los ítems agregados con su respectivo objeto producto entero
    const itemsParaGuardar = Object.entries(pedidoActual)
      .map(([id, quantity]) => {
        const product = products.find((p) => p.id === id);
        return product ? { product, quantity } : null;
      })
      .filter((item): item is { product: Product; quantity: number } => item !== null);

    // 2. Construimos el nuevo pedido con el estado inicial "Pendiente"
    const nuevoPedido: Pedido = {
      id: `o_${Date.now()}`,
      tableNumber: selectedMesa.number,
      items: itemsParaGuardar,
      total: calcularTotal(),
      status: "Pendiente", // Requisito solicitado
      timestamp: Date.now()
    };

    // 3. Conseguir historial de pedidos previos del store para no borrarlos
    const pedidosExistentes = (store as any).getOrders?.() || [];
    const listaActualizadaPedidos = [...pedidosExistentes, nuevoPedido];

    // 4. Guardar pedidos en el store para que impacte la vista "Pedidos"
    if ((store as any).saveOrders) {
      (store as any).saveOrders(listaActualizadaPedidos);
    } else {
      // Respaldo inmediato en localStorage compatible con el lector de tu dashboard
      localStorage.setItem("sazon_latino_orders", JSON.stringify(listaActualizadaPedidos));
    }

    // 5. Modificamos el estado visual de la mesa seleccionada a "Ocupada"
    const mesasModificadas = mesas.map((m) => 
      m.id === selectedMesa.id ? { ...m, status: "Ocupada" as const } : m
    );
    actualizarMesas(mesasModificadas);
    
    // Cerrar modal
    setSelectedMesa(null);
  };

  return (
    <div className="p-6 bg-[#120f0d] min-h-screen text-amber-500">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-serif text-amber-500">Mesas</h1>
        {isAdmin && (
          <Button
            onClick={handleAddMesa}
            className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1 border-none"
          >
            <Plus size={18} /> Agregar Mesa
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mesas.map((mesa) => (
          <div
            key={mesa.id}
            className="group relative flex items-center justify-between p-5 bg-[#1c1816] border border-stone-800 rounded-xl hover:border-amber-600/50 transition-all"
          >
            <div>
              <p className="text-white font-serif text-xl">Mesa {mesa.number}</p>
              <p className={`text-sm mt-1 ${mesa.status === "Ocupada" ? "text-amber-500 font-semibold" : "text-stone-400"}`}>
                {mesa.status}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleOpenPedido(mesa)}
                className="p-2 text-stone-500 hover:text-white transition-colors"
                title="Nuevo Pedido"
              >
                <Plus size={20} />
              </button>
              
              {isAdmin && (
                <button
                  onClick={() => handleDeleteMesa(mesa.id, mesa.number)}
                  className="p-2 text-stone-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                  title="Eliminar Mesa"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL DE NUEVO PEDIDO */}
      {selectedMesa && (
        <Dialog open onOpenChange={() => setSelectedMesa(null)}>
          <DialogContent className="max-w-2xl bg-[#1c1816] border border-stone-800 text-white rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-amber-500 text-2xl">
                Nuevo Pedido — Mesa {selectedMesa.number}
              </DialogTitle>
            </DialogHeader>

            <div className="flex gap-2 my-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeCategory === cat
                      ? "bg-amber-500 text-black"
                      : "bg-stone-800 text-stone-400 hover:bg-stone-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4 max-h-[300px] overflow-y-auto pr-1">
              {products
                .filter((p) => p.category === activeCategory)
                .map((product) => {
                  const cantidad = pedidoActual[product.id] || 0;
                  return (
                    <div
                      key={product.id}
                      onClick={() => handleAddItem(product.id)}
                      className="p-4 bg-[#26211e] border border-stone-800 rounded-xl cursor-pointer hover:border-amber-500/40 transition-all flex justify-between items-center"
                    >
                      <div>
                        <p className="text-white font-medium text-base">{product.name}</p>
                        <p className="text-amber-500 font-semibold mt-1">${product.price}</p>
                      </div>
                      {cantidad > 0 && (
                        <span className="bg-amber-500 text-black font-bold text-xs px-2.5 py-1 rounded-full">
                          x{cantidad}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>

            <hr className="border-stone-800 my-2" />

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-stone-400 text-xs uppercase tracking-wider">Total</p>
                <p className="text-amber-500 text-3xl font-semibold">${calcularTotal().toFixed(2)}</p>
              </div>
              <Button
                onClick={handleCrearPedidoFinal}
                disabled={calcularTotal() === 0}
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-6 px-6 rounded-xl border-none"
              >
                Crear Pedido
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Mesas;