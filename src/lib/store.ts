// Simple localStorage-based store for the restaurant app

export type UserRole = "admin" | "waiter";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}

export interface OrderItem {
  product: Product;
  quantity: number;
  notes?: string;
}

export type OrderStatus = "pending" | "preparing" | "delivered" | "paid";

export interface Order {
  id: string;
  tableNumber: number;
  items: OrderItem[];
  status: OrderStatus;
  waiterId: string;
  waiterName: string;
  createdAt: string;
  updatedAt: string;
  total: number;
}

const USERS_KEY = "sazon_users";
const ORDERS_KEY = "sazon_orders";
const PRODUCTS_KEY = "sazon_products";
const CURRENT_USER_KEY = "sazon_current_user";

const defaultUsers: User[] = [
  { id: "1", name: "Admin", role: "admin", pin: "1234" },
  { id: "2", name: "Carlos", role: "waiter", pin: "1111" },
  { id: "3", name: "María", role: "waiter", pin: "2222" },
];

const defaultProducts: Product[] = [
  { id: "p1", name: "Tacos al Pastor", price: 85, category: "Comida" },
  { id: "p2", name: "Enchiladas Verdes", price: 95, category: "Comida" },
  { id: "p3", name: "Burrito Especial", price: 110, category: "Comida" },
  { id: "p4", name: "Quesadillas", price: 75, category: "Comida" },
  { id: "p5", name: "Guacamole con Totopos", price: 65, category: "Entrada" },
  { id: "p6", name: "Sopa Azteca", price: 55, category: "Entrada" },
  { id: "p7", name: "Empanadas (3 pzas)", price: 60, category: "Entrada" },
  { id: "p8", name: "Agua de Horchata", price: 35, category: "Bebida" },
  { id: "p9", name: "Limonada Natural", price: 30, category: "Bebida" },
  { id: "p10", name: "Cerveza", price: 45, category: "Bebida" },
  { id: "p11", name: "Margarita", price: 75, category: "Bebida" },
  { id: "p12", name: "Flan Napolitano", price: 50, category: "Postre" },
  { id: "p13", name: "Churros con Chocolate", price: 45, category: "Postre" },
  { id: "p14", name: "Arroz con Leche", price: 40, category: "Postre" },
];

function getItem<T>(key: string, defaults: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaults;
  } catch {
    return defaults;
  }
}

function setItem<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const store = {
  getUsers: (): User[] => getItem(USERS_KEY, defaultUsers),
  getProducts: (): Product[] => getItem(PRODUCTS_KEY, defaultProducts),
  getOrders: (): Order[] => getItem(ORDERS_KEY, []),

  saveOrders: (orders: Order[]) => setItem(ORDERS_KEY, orders),
  saveProducts: (products: Product[]) => setItem(PRODUCTS_KEY, products),

  login: (pin: string): User | null => {
    const users = store.getUsers();
    const user = users.find((u) => u.pin === pin);
    if (user) setItem(CURRENT_USER_KEY, user);
    return user || null;
  },

  logout: () => localStorage.removeItem(CURRENT_USER_KEY),

  getCurrentUser: (): User | null => getItem(CURRENT_USER_KEY, null),

  createOrder: (tableNumber: number, items: OrderItem[], waiterId: string, waiterName: string): Order => {
    const orders = store.getOrders();
    const order: Order = {
      id: `ord_${Date.now()}`,
      tableNumber,
      items,
      status: "pending",
      waiterId,
      waiterName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      total: items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    };
    orders.push(order);
    store.saveOrders(orders);
    return order;
  },

  updateOrderStatus: (orderId: string, status: OrderStatus) => {
    const orders = store.getOrders();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx >= 0) {
      orders[idx].status = status;
      orders[idx].updatedAt = new Date().toISOString();
      store.saveOrders(orders);
    }
  },

  updateOrderItems: (orderId: string, items: OrderItem[]) => {
    const orders = store.getOrders();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx >= 0) {
      orders[idx].items = items;
      orders[idx].total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      orders[idx].updatedAt = new Date().toISOString();
      store.saveOrders(orders);
    }
  },

  deleteOrder: (orderId: string) => {
    const orders = store.getOrders().filter((o) => o.id !== orderId);
    store.saveOrders(orders);
  },
};
