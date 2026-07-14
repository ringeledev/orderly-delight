import ExcelJS from "exceljs";
import { type Pedido } from "./db";

interface ExportOptions {
  orders: Pedido[]; // pedidos cerrados de clientes (sin mesas de personal)
  ordersPersonal: Pedido[]; // pedidos cerrados de mesas de personal
  periodoLabel: string;
}

interface ProductRow {
  nombre: string;
  categoria: string;
  cantidad: number;
  total: number;
  precioUnitario: number;
}

// ── Paleta — coincide con el dorado/ámbar de la app ───────────────────────────
const COLOR_HEADER = "FFB8860B"; // ámbar oscuro
const COLOR_HEADER_TEXT = "FFFFFFFF";
const COLOR_BAND = "FFF7F0E0"; // beige clarito para filas alternadas
const COLOR_TOTAL_BG = "FFFFE8B8";
const FONT_NAME = "Calibri";

function desgloseDeOrdenes(orders: Pedido[]): ProductRow[] {
  const map: Record<string, ProductRow> = {};
  orders.forEach((o) => {
    (o.detalles_pedido ?? []).forEach((d) => {
      const nombre = d.productos?.nombre ?? d.nombre_extra ?? "Extra";
      const categoria = d.productos?.categoria || "Sin categoría";
      const key = `${categoria}|${nombre}`;
      if (!map[key]) map[key] = { nombre, categoria, cantidad: 0, total: 0, precioUnitario: d.precio_historico };
      map[key].cantidad += d.cantidad;
      map[key].total += d.precio_historico * d.cantidad;
    });
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

function desgloseCategorias(rows: ProductRow[]) {
  const map: Record<string, { categoria: string; cantidad: number; total: number }> = {};
  rows.forEach((r) => {
    if (!map[r.categoria]) map[r.categoria] = { categoria: r.categoria, cantidad: 0, total: 0 };
    map[r.categoria].cantidad += r.cantidad;
    map[r.categoria].total += r.total;
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

/** Aplica el estilo de encabezado (fondo ámbar, texto blanco, negrita) a la fila 1 y activa el autofiltro. */
function estilizarTabla(ws: ExcelJS.Worksheet, columnas: number) {
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { name: FONT_NAME, bold: true, color: { argb: COLOR_HEADER_TEXT }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD9B25B" } },
      bottom: { style: "thin", color: { argb: "FFD9B25B" } },
      left: { style: "thin", color: { argb: "FFD9B25B" } },
      right: { style: "thin", color: { argb: "FFD9B25B" } },
    };
  });
  headerRow.height = 22;

  // Bandas alternadas + bordes finos en el resto de filas
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const esBanda = r % 2 === 0;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: FONT_NAME, size: 10.5 };
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFE0D5C0" } },
      };
      if (esBanda) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_BAND } };
      }
    });
  }

  // Autofiltro sobre todo el rango de datos
  const lastCol = String.fromCharCode(64 + columnas);
  ws.autoFilter = { from: "A1", to: `${lastCol}${ws.rowCount}` };
  ws.views = [{ state: "frozen", ySplit: 1 }]; // congelar encabezado al scrollear
}

function nuevaHoja(wb: ExcelJS.Workbook, nombre: string, columnas: { header: string; key: string; width: number }[]) {
  const ws = wb.addWorksheet(nombre, {
    properties: { tabColor: { argb: COLOR_HEADER } },
  });
  ws.columns = columnas;
  return ws;
}

/**
 * Genera y descarga un Excel (.xlsx) prolijo, con encabezados estilizados,
 * filas alternadas, autofiltros en cada hoja y formato de moneda en los totales:
 * - Resumen: totales generales
 * - Por Categoría: bebidas, comida, extras, etc.
 * - Productos: detalle ítem por ítem con precio unitario
 * - Por Mesero: cada mesero con su propio desglose de categorías
 * - Consumo Personal: lo mismo pero para mesas de personal
 * - Historial: todas las transacciones, una fila por pedido
 */
export async function exportarReporteExcel({ orders, ordersPersonal, periodoLabel }: ExportOptions) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sazón Latino";
  wb.created = new Date();

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const totalPersonal = ordersPersonal.reduce((s, o) => s + Number(o.total), 0);
  const moneyFmt = '$#,##0.00';

  // ── Resumen ──
  const wsResumen = nuevaHoja(wb, "Resumen", [
    { header: "Métrica", key: "metrica", width: 28 },
    { header: "Valor", key: "valor", width: 22 },
  ]);
  wsResumen.addRow({ metrica: "Período", valor: periodoLabel });
  wsResumen.addRow({ metrica: "Ingresos (clientes)", valor: totalRevenue });
  wsResumen.addRow({ metrica: "Pedidos (clientes)", valor: orders.length });
  wsResumen.addRow({ metrica: "Ticket promedio", valor: orders.length > 0 ? totalRevenue / orders.length : 0 });
  wsResumen.addRow({ metrica: "Consumo Personal", valor: totalPersonal });
  wsResumen.addRow({ metrica: "Pedidos Personal", valor: ordersPersonal.length });
  [3, 5, 6].forEach((r) => (wsResumen.getCell(`B${r}`).numFmt = moneyFmt));
  estilizarTabla(wsResumen, 2);
  // Destacar la fila de Ingresos
  wsResumen.getRow(3).eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TOTAL_BG } };
    c.font = { name: FONT_NAME, bold: true, size: 11 };
  });

  // ── Por Categoría ──
  const productos = desgloseDeOrdenes(orders);
  const categorias = desgloseCategorias(productos);
  const wsCategorias = nuevaHoja(wb, "Por Categoría", [
    { header: "Categoría", key: "categoria", width: 22 },
    { header: "Cantidad vendida", key: "cantidad", width: 18 },
    { header: "Total", key: "total", width: 16 },
    { header: "% del total", key: "pct", width: 14 },
  ]);
  categorias.forEach((c) => {
    wsCategorias.addRow({
      categoria: c.categoria,
      cantidad: c.cantidad,
      total: c.total,
      pct: totalRevenue > 0 ? c.total / totalRevenue : 0,
    });
  });
  wsCategorias.getColumn("total").numFmt = moneyFmt;
  wsCategorias.getColumn("pct").numFmt = "0.0%";
  estilizarTabla(wsCategorias, 4);

  // ── Productos ──
  const wsProductos = nuevaHoja(wb, "Productos", [
    { header: "Producto", key: "producto", width: 30 },
    { header: "Categoría", key: "categoria", width: 20 },
    { header: "Precio unitario", key: "precio", width: 16 },
    { header: "Cantidad", key: "cantidad", width: 12 },
    { header: "Total", key: "total", width: 16 },
  ]);
  productos.forEach((p) => {
    wsProductos.addRow({
      producto: p.nombre,
      categoria: p.categoria,
      precio: p.precioUnitario,
      cantidad: p.cantidad,
      total: p.total,
    });
  });
  wsProductos.getColumn("precio").numFmt = moneyFmt;
  wsProductos.getColumn("total").numFmt = moneyFmt;
  estilizarTabla(wsProductos, 5);

  // ── Por Mesero ──
  const porMesero: Record<string, { nombre: string; orders: Pedido[] }> = {};
  orders.forEach((o) => {
    const id = o.mesero_id;
    const nombre = o.profiles?.nombre ?? "Desconocido";
    if (!porMesero[id]) porMesero[id] = { nombre, orders: [] };
    porMesero[id].orders.push(o);
  });

  const wsMeseros = nuevaHoja(wb, "Por Mesero", [
    { header: "Mesero", key: "mesero", width: 20 },
    { header: "Categoría", key: "categoria", width: 22 },
    { header: "Cantidad", key: "cantidad", width: 14 },
    { header: "Total", key: "total", width: 16 },
  ]);

  const filasTotal: number[] = [];
  Object.values(porMesero)
    .sort((a, b) => b.orders.length - a.orders.length)
    .forEach((m) => {
      const total = m.orders.reduce((s, o) => s + Number(o.total), 0);
      const prods = desgloseDeOrdenes(m.orders);
      const cats = desgloseCategorias(prods);

      wsMeseros.addRow({
        mesero: m.nombre,
        categoria: "TOTAL — " + m.orders.length + " pedidos",
        cantidad: "",
        total,
      });
      filasTotal.push(wsMeseros.rowCount);

      cats.forEach((c) => {
        wsMeseros.addRow({ mesero: "", categoria: c.categoria, cantidad: c.cantidad, total: c.total });
      });
    });
  wsMeseros.getColumn("total").numFmt = moneyFmt;
  estilizarTabla(wsMeseros, 4);
  filasTotal.forEach((r) => {
    wsMeseros.getRow(r).eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TOTAL_BG } };
      c.font = { name: FONT_NAME, bold: true, size: 10.5 };
    });
  });

  // ── Consumo Personal ──
  if (ordersPersonal.length > 0) {
    const prodsPersonal = desgloseDeOrdenes(ordersPersonal);
    const catsPersonal = desgloseCategorias(prodsPersonal);
    const wsPersonal = nuevaHoja(wb, "Consumo Personal", [
      { header: "Categoría", key: "categoria", width: 22 },
      { header: "Producto", key: "nombre", width: 28 },
      { header: "Precio unitario", key: "precioUnitario", width: 16 },
      { header: "Cantidad", key: "cantidad", width: 12 },
      { header: "Total", key: "total", width: 16 },
    ]);
    const filasTotalPersonal: number[] = [];
    catsPersonal.forEach((c) => {
      const itemsDeCat = prodsPersonal.filter((p) => p.categoria === c.categoria);
      wsPersonal.addRow({ categoria: c.categoria, nombre: "TOTAL " + c.categoria, precioUnitario: "", cantidad: c.cantidad, total: c.total });
      filasTotalPersonal.push(wsPersonal.rowCount);
      itemsDeCat.forEach((p) => {
        wsPersonal.addRow({ categoria: "", nombre: p.nombre, precioUnitario: p.precioUnitario, cantidad: p.cantidad, total: p.total });
      });
    });
    wsPersonal.getColumn("precioUnitario").numFmt = moneyFmt;
    wsPersonal.getColumn("total").numFmt = moneyFmt;
    estilizarTabla(wsPersonal, 5);
    filasTotalPersonal.forEach((r) => {
      wsPersonal.getRow(r).eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE3F7" } };
        c.font = { name: FONT_NAME, bold: true, size: 10.5 };
      });
    });
  }

  // ── Historial ──
  const todas = [...orders, ...ordersPersonal].sort(
    (a, b) => new Date(b.cerrado_at ?? b.created_at).getTime() - new Date(a.cerrado_at ?? a.created_at).getTime()
  );
  const wsHistorial = nuevaHoja(wb, "Historial", [
    { header: "Fecha", key: "fecha", width: 20 },
    { header: "Mesa", key: "mesa", width: 10 },
    { header: "Tipo", key: "tipo", width: 12 },
    { header: "Cliente", key: "cliente", width: 18 },
    { header: "Mesero", key: "mesero", width: 18 },
    { header: "Ítems", key: "items", width: 10 },
    { header: "Total", key: "total", width: 14 },
  ]);
  todas.forEach((o) => {
    wsHistorial.addRow({
      fecha: new Date(o.cerrado_at ?? o.created_at).toLocaleString("es-AR"),
      mesa: o.mesas?.numero ?? "—",
      tipo: o.mesas?.es_personal ? "Personal" : "Cliente",
      cliente: o.cliente_nombre ?? "",
      mesero: o.profiles?.nombre ?? "",
      items: o.detalles_pedido?.length ?? 0,
      total: Number(o.total),
    });
  });
  wsHistorial.getColumn("total").numFmt = moneyFmt;
  estilizarTabla(wsHistorial, 7);
  // Resaltar filas de consumo Personal en violeta clarito
  wsHistorial.eachRow((row, idx) => {
    if (idx === 1) return;
    if (row.getCell("tipo").value === "Personal") {
      row.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE3F7" } };
      });
    }
  });

  // ── Descargar ──
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fecha = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `Sazon_Latino_Reporte_${fecha}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
