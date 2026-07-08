import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

export type EstadoPedido = "pendiente" | "en_preparacion" | "listo" | "entregado" | "cancelado";
export type EstadoMesa = "libre" | "ocupada";

export type DestinoImpresion = "cocina" | "barra" | "ninguno";

export interface Producto {
  uuid: string;
  nombre: string;
  precio: number;
  categoria: string;
  disponible: boolean;
  destino_impresion?: DestinoImpresion;
}

export interface Mesa {
  uuid: string;
  numero: number;
  estado_actual: EstadoMesa;
  es_personal?: boolean;
}

export interface DetallePedido {
  uuid?: string;
  pedido_id?: string;
  producto_id: string | null;
  cantidad: number;
  precio_historico: number;
  notas?: string;
  nombre_extra?: string;
  cobrado?: boolean;
  productos?: Producto;
}

export interface Pedido {
  uuid: string;
  mesa_id: string;
  mesero_id: string;
  cliente_nombre?: string;
  estado: EstadoPedido;
  total: number;
  created_at: string;
  updated_at?: string;
  cerrado_at?: string | null;
  motivo?: string | null;
  mesas?: { numero: number; estado_actual: EstadoMesa; es_personal?: boolean };
  detalles_pedido?: DetallePedido[];
  profiles?: { nombre: string; color?: string };
}

export interface NuevoDetalle {
  producto_id: string | null;
  cantidad: number;
  precio_historico: number;
  notas?: string;
  nombre_extra?: string;
}

export interface ProfileUser {
  id: string;
  name: string;
  role: string;
  sessionToken?: string;
}

export interface ResumenDia {
  totalRecaudado: number;
  cantidadPedidos: number;
  ticketPromedio: number;
  cantidadClientes: number;
  productoEstrella: { nombre: string; cantidad: number } | null;
  consumoPersonal: { total: number; cantidadPedidos: number };
}

export interface MeseroStats {
  mesero_id: string;
  nombre: string;
  total: number;
  pedidos: number;
}

export interface ConsumoPersonalItem {
  nombre: string;
  categoria: string;
  cantidad: number;
  total: number;
}

export interface ConsumoPersonalCategoria {
  categoria: string;
  total: number;
  cantidad: number;
  items: ConsumoPersonalItem[];
}

export interface ConsumoPersonalDetalle {
  total: number;
  cantidadPedidos: number;
  categorias: ConsumoPersonalCategoria[];
}

// ── Selects reutilizables ────────────────────────────────────────────────────

const DETALLE_SEL =
  "uuid, producto_id, cantidad, precio_historico, notas, nombre_extra, cobrado, productos(uuid, nombre, precio, categoria, destino_impresion)";

const PEDIDO_ACTIVO_SEL = `uuid, mesa_id, mesero_id, cliente_nombre, estado, total, created_at, mesas(numero, estado_actual, es_personal), detalles_pedido(${DETALLE_SEL}), profiles(nombre, color)`;

const PEDIDO_CERRADO_SEL = `uuid, mesa_id, mesero_id, cliente_nombre, estado, total, created_at, cerrado_at, motivo, mesas(numero, estado_actual, es_personal), detalles_pedido(${DETALLE_SEL}), profiles(nombre, color)`;

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function loginWithPin(pin: string): Promise<ProfileUser | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("uuid, nombre, rol")
    .eq("pin", pin)
    .eq("activo", true)
    .single();
  if (error || !data) return null;

  // Try to set session token (non-blocking — requires session_token column in DB)
  let sessionToken: string | undefined;
  try {
    sessionToken = crypto.randomUUID();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ session_token: sessionToken })
      .eq("uuid", data.uuid);
    if (updateError) sessionToken = undefined;
  } catch {
    sessionToken = undefined;
  }

  return { id: data.uuid, name: data.nombre, role: data.rol, sessionToken };
}

// ── Gestión de usuarios (admin) ──────────────────────────────────────────────

export interface UsuarioAdmin {
  uuid: string;
  nombre: string;
  rol: "admin" | "waiter";
  pin: string;
  activo: boolean;
  color?: string;
}

export async function getUsuarios(): Promise<UsuarioAdmin[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("uuid, nombre, rol, pin, activo, color")
    .order("nombre");
  if (error) throw error;
  return data as UsuarioAdmin[];
}

export async function createUsuario(payload: Omit<UsuarioAdmin, "uuid">): Promise<void> {
  const { error } = await supabase.from("profiles").insert({
    nombre: payload.nombre,
    rol: payload.rol,
    pin: payload.pin,
    activo: payload.activo,
  });
  if (error) throw error;
}

export async function updateUsuario(uuid: string, payload: Partial<Omit<UsuarioAdmin, "uuid">>): Promise<void> {
  const { error } = await supabase.from("profiles").update(payload).eq("uuid", uuid);
  if (error) throw error;
}

export async function deleteUsuario(uuid: string): Promise<void> {
  const { error } = await supabase.from("profiles").delete().eq("uuid", uuid);
  if (error) throw error;
}

export async function verifySession(userId: string, sessionToken: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("session_token")
    .eq("uuid", userId)
    .single();
  if (error || !data) return true; // network error → don't kick
  if (!data.session_token) return true; // column null → no session set yet
  return data.session_token === sessionToken;
}

// ── Productos ────────────────────────────────────────────────────────────────

export async function getProductos(soloDisponibles = true): Promise<Producto[]> {
  let query = supabase
    .from("productos")
    .select("uuid, nombre, precio, categoria, disponible, destino_impresion")
    .order("categoria");
  if (soloDisponibles) query = query.eq("disponible", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createProducto(payload: Omit<Producto, "uuid">): Promise<Producto> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("productos")
    .insert({ ...payload, created_at: now, updated_at: now })
    .select("uuid, nombre, precio, categoria, disponible, destino_impresion")
    .single();
  if (error) throw error;
  return data as Producto;
}

export async function updateProducto(
  uuid: string,
  payload: Partial<Omit<Producto, "uuid">>
): Promise<void> {
  const { error } = await supabase
    .from("productos")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("uuid", uuid);
  if (error) throw error;
}

export async function deleteProducto(uuid: string): Promise<void> {
  const { error } = await supabase.from("productos").delete().eq("uuid", uuid);
  if (error) throw error;
}

// ── Mesas ─────────────────────────────────────────────────────────────────────

export async function getMesas(): Promise<Mesa[]> {
  const { data, error } = await supabase
    .from("mesas")
    .select("uuid, numero, estado_actual, es_personal")
    .order("numero");
  if (error) throw error;
  return data ?? [];
}

export async function createMesa(numero: number, esPersonal = false): Promise<Mesa> {
  const now = new Date().toISOString();
  let intento = numero;

  for (let i = 0; i < 10; i++) {
    const { data, error } = await supabase
      .from("mesas")
      .insert({ numero: intento, estado_actual: "libre", es_personal: esPersonal, created_at: now, updated_at: now })
      .select("uuid, numero, estado_actual, es_personal")
      .single();

    if (!error) return data as Mesa;

    // Número ya existe (estado local desincronizado con la BD) -> reintentar con el siguiente
    if (error.code === "23505") {
      intento += 1;
      continue;
    }
    throw error;
  }

  throw new Error("No se pudo asignar un número de mesa disponible. Intentá de nuevo.");
}

export async function deleteMesa(uuid: string): Promise<void> {
  const { error } = await supabase.from("mesas").delete().eq("uuid", uuid);
  if (error) throw error;
}

// ── Resumen del día (admin) ───────────────────────────────────────────────────

export async function getResumenHoy(): Promise<ResumenDia> {
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("pedidos")
    .select("total, cliente_nombre, cerrado_at, motivo, mesas(es_personal), detalles_pedido(cantidad, nombre_extra, productos(nombre))")
    .eq("estado", "cancelado")
    .gte("cerrado_at", inicioHoy.toISOString());
  if (error) throw error;

  const todos = (data ?? []).filter((p: any) => p.motivo !== "anulado");
  const pedidos = todos.filter((p: any) => !p.mesas?.es_personal);
  const pedidosPersonal = todos.filter((p: any) => p.mesas?.es_personal);

  const totalRecaudado = pedidos.reduce((s, p) => s + Number(p.total), 0);
  const cantidadPedidos = pedidos.length;
  const ticketPromedio = cantidadPedidos > 0 ? totalRecaudado / cantidadPedidos : 0;
  const clientes = new Set(pedidos.map((p) => p.cliente_nombre).filter(Boolean));

  const conteo: Record<string, number> = {};
  pedidos.forEach((p) => {
    (p.detalles_pedido ?? []).forEach((d: any) => {
      const nombre = d.productos?.nombre ?? d.nombre_extra ?? "Extra";
      conteo[nombre] = (conteo[nombre] ?? 0) + d.cantidad;
    });
  });
  const sorted = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
  const productoEstrella = sorted[0]
    ? { nombre: sorted[0][0], cantidad: sorted[0][1] }
    : null;

  const consumoPersonal = {
    total: pedidosPersonal.reduce((s, p) => s + Number(p.total), 0),
    cantidadPedidos: pedidosPersonal.length,
  };

  return {
    totalRecaudado,
    cantidadPedidos,
    ticketPromedio,
    cantidadClientes: clientes.size,
    productoEstrella,
    consumoPersonal,
  };
}

// ── Reportes por mesero ───────────────────────────────────────────────────────

export async function getReportesMeseros(desdeDias = 1): Promise<MeseroStats[]> {
  const desde = new Date();
  desde.setDate(desde.getDate() - desdeDias + 1);
  desde.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("pedidos")
    .select("total, mesero_id, mesas(es_personal), profiles(nombre)")
    .eq("estado", "cancelado")
    .gte("cerrado_at", desde.toISOString());
  if (error) throw error;

  const map: Record<string, MeseroStats> = {};
  (data ?? [])
    .filter((p: any) => !p.mesas?.es_personal)
    .forEach((p: any) => {
    const id = p.mesero_id;
    const nombre = p.profiles?.nombre ?? "Desconocido";
    if (!map[id]) map[id] = { mesero_id: id, nombre, total: 0, pedidos: 0 };
    map[id].total += Number(p.total);
    map[id].pedidos += 1;
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

// ── Consumo de Mesas de Personal (detallado por categoría e ítem) ────────────

export async function getConsumoPersonalDetallado(desdeDias = 1): Promise<ConsumoPersonalDetalle> {
  const desde = new Date();
  desde.setDate(desde.getDate() - desdeDias + 1);
  desde.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("pedidos")
    .select(
      "total, mesas!inner(es_personal), detalles_pedido(cantidad, precio_historico, nombre_extra, productos(nombre, categoria))"
    )
    .eq("estado", "cancelado")
    .eq("mesas.es_personal", true)
    .gte("cerrado_at", desde.toISOString());
  if (error) throw error;

  const pedidos = data ?? [];
  const total = pedidos.reduce((s, p: any) => s + Number(p.total), 0);
  const cantidadPedidos = pedidos.length;

  const itemMap: Record<string, ConsumoPersonalItem> = {};
  pedidos.forEach((p: any) => {
    (p.detalles_pedido ?? []).forEach((d: any) => {
      const nombre = d.productos?.nombre ?? d.nombre_extra ?? "Extra";
      const categoria = d.productos?.categoria ?? "Sin categoría";
      const key = `${categoria}|${nombre}`;
      if (!itemMap[key]) itemMap[key] = { nombre, categoria, cantidad: 0, total: 0 };
      itemMap[key].cantidad += d.cantidad;
      itemMap[key].total += d.precio_historico * d.cantidad;
    });
  });

  const porCategoria: Record<string, ConsumoPersonalCategoria> = {};
  Object.values(itemMap).forEach((item) => {
    if (!porCategoria[item.categoria]) {
      porCategoria[item.categoria] = { categoria: item.categoria, total: 0, cantidad: 0, items: [] };
    }
    porCategoria[item.categoria].total += item.total;
    porCategoria[item.categoria].cantidad += item.cantidad;
    porCategoria[item.categoria].items.push(item);
  });

  const categorias = Object.values(porCategoria)
    .map((c) => ({ ...c, items: c.items.sort((a, b) => b.total - a.total) }))
    .sort((a, b) => b.total - a.total);

  return { total, cantidadPedidos, categorias };
}

// ── Pedidos por mesa (split bill) ────────────────────────────────────────────

export async function getPedidosPorMesa(mesaUuid: string): Promise<Pedido[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select(PEDIDO_ACTIVO_SEL)
    .eq("mesa_id", mesaUuid)
    .not("estado", "in", '("entregado","cancelado")')
    .is("cerrado_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Pedido[];
}

export async function cerrarPedidoIndividual(
  pedidoUuid: string,
  mesaUuid: string,
  esElUltimo: boolean
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("pedidos")
    .update({ estado: "cancelado", motivo: "cobrado", cerrado_at: now, updated_at: now })
    .eq("uuid", pedidoUuid);
  if (error) throw error;

  if (esElUltimo) {
    const { error: mesaError } = await supabase
      .from("mesas")
      .update({ estado_actual: "libre", updated_at: now })
      .eq("uuid", mesaUuid);
    if (mesaError) throw mesaError;
  }
}

export async function agregarDetallesAPedido(
  pedidoUuid: string,
  detalles: NuevoDetalle[]
): Promise<void> {
  const rows = detalles.map((d) => ({ ...d, pedido_id: pedidoUuid }));
  const { error: detallesError } = await supabase.from("detalles_pedido").insert(rows);
  if (detallesError) throw detallesError;

  // Recalculate total
  const { data: allDetalles, error: fetchError } = await supabase
    .from("detalles_pedido")
    .select("precio_historico, cantidad")
    .eq("pedido_id", pedidoUuid);
  if (fetchError) throw fetchError;

  const nuevoTotal = (allDetalles ?? []).reduce(
    (s, d) => s + Number(d.precio_historico) * Number(d.cantidad),
    0
  );
  await supabase
    .from("pedidos")
    .update({ total: nuevoTotal, updated_at: new Date().toISOString() })
    .eq("uuid", pedidoUuid);
}

export async function cancelarPedido(pedidoUuid: string, mesaUuid: string): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("pedidos")
    .update({ estado: "cancelado", motivo: "anulado", cerrado_at: now, updated_at: now })
    .eq("uuid", pedidoUuid);
  if (error) throw error;

  // Ver si quedan otros pedidos activos en la mesa
  const { data: otros, error: otrosError } = await supabase
    .from("pedidos")
    .select("uuid")
    .eq("mesa_id", mesaUuid)
    .not("estado", "in", '("cancelado")');

  // Solo liberar si el query fue exitoso Y no quedan pedidos activos
  if (!otrosError && otros && otros.length === 0) {
    await supabase
      .from("mesas")
      .update({ estado_actual: "libre", updated_at: now })
      .eq("uuid", mesaUuid);
  }
}

export async function cobrarDetalles(
  detalleUuids: string[],
  pedidoUuid: string,
  mesaUuid: string,
  cerrarPedido: boolean,
  liberarMesa: boolean
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("detalles_pedido")
    .update({ cobrado: true })
    .in("uuid", detalleUuids);
  if (error) throw error;

  // Cierra ESTE pedido individual en cuanto todos sus ítems están cobrados,
  // sin importar si otros clientes siguen activos en la misma mesa.
  if (cerrarPedido) {
    await supabase
      .from("pedidos")
      .update({ estado: "cancelado", motivo: "cobrado", cerrado_at: now, updated_at: now })
      .eq("uuid", pedidoUuid);
  }

  // La mesa solo se libera cuando este era el último pedido activo.
  if (liberarMesa) {
    await supabase
      .from("mesas")
      .update({ estado_actual: "libre", updated_at: now })
      .eq("uuid", mesaUuid);
  }
}

// ── Pedidos ──────────────────────────────────────────────────────────────────

export async function getTodosPedidos(): Promise<Pedido[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select(PEDIDO_CERRADO_SEL)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as Pedido[];
}

export async function getPedidosCerrados(): Promise<Pedido[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select(PEDIDO_CERRADO_SEL)
    .eq("estado", "cancelado")
    .not("cerrado_at", "is", null)
    .order("cerrado_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Pedido[];
}

export async function getPedidosActivos(): Promise<Pedido[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select(PEDIDO_ACTIVO_SEL)
    .not("estado", "in", '("entregado","cancelado")')
    .is("cerrado_at", null);
  if (error) throw error;
  return (data ?? []) as Pedido[];
}

export async function createPedido(
  mesaNumero: number,
  detalles: NuevoDetalle[],
  meseroId: string,
  clienteNombre?: string
): Promise<Pedido> {
  const { data: mesa, error: mesaError } = await supabase
    .from("mesas")
    .select("uuid")
    .eq("numero", mesaNumero)
    .single();
  if (mesaError || !mesa) throw mesaError ?? new Error(`Mesa ${mesaNumero} no encontrada`);

  const total = detalles.reduce((s, d) => s + d.precio_historico * d.cantidad, 0);
  const now = new Date().toISOString();

  const { data: pedido, error: pedidoError } = await supabase
    .from("pedidos")
    .insert({
      mesa_id: mesa.uuid,
      mesero_id: meseroId,
      cliente_nombre: clienteNombre ?? null,
      estado: "pendiente" as EstadoPedido,
      total,
      created_at: now,
      updated_at: now,
    })
    .select("uuid, mesa_id, mesero_id, cliente_nombre, estado, total, created_at")
    .single();
  if (pedidoError || !pedido) throw pedidoError ?? new Error("Error al crear pedido");

  const rows = detalles.map((d) => ({ ...d, pedido_id: pedido.uuid }));
  const { error: detallesError } = await supabase.from("detalles_pedido").insert(rows);
  if (detallesError) throw detallesError;

  await supabase
    .from("mesas")
    .update({ estado_actual: "ocupada", updated_at: now })
    .eq("uuid", mesa.uuid);

  return pedido as Pedido;
}

export async function updateEstadoPedido(
  pedidoUuid: string,
  estado: EstadoPedido,
  mesaId?: string
): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { estado, updated_at: now };
  if (estado === "entregado" || estado === "cancelado") patch.cerrado_at = now;

  const { error } = await supabase.from("pedidos").update(patch).eq("uuid", pedidoUuid);
  if (error) throw error;

  if ((estado === "entregado" || estado === "cancelado") && mesaId) {
    await supabase
      .from("mesas")
      .update({ estado_actual: "libre", updated_at: now })
      .eq("uuid", mesaId);
  }
}

export async function deletePedido(pedidoUuid: string, mesaId?: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from("detalles_pedido").delete().eq("pedido_id", pedidoUuid);
  const { error } = await supabase.from("pedidos").delete().eq("uuid", pedidoUuid);
  if (error) throw error;
  if (mesaId) {
    await supabase
      .from("mesas")
      .update({ estado_actual: "libre", updated_at: now })
      .eq("uuid", mesaId);
  }
}
