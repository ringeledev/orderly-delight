# Sazón Latino — Print Middleware

Servicio Node.js que recibe pedidos de impresión desde el navegador (vía HTTP)
y los reenvía como comandos ESC/POS crudos a tus impresoras Epson TM-T88V
conectadas por **USB**, incluyendo la apertura de la gaveta CD1100.

---

## PASO 1 — Instalar el driver de la impresora en Windows

1. Conectá la impresora por USB y encendéla.
2. Windows debería detectarla sola. Si no, descargá el driver "Advanced Printer Driver"
   desde la web de soporte de Epson para TM-T88V e instalalo.
3. Confirmá que aparece en **Configuración → Bluetooth y dispositivos → Impresoras y escáneres**
   (o "Dispositivos e impresoras" en el panel de control clásico).

Repetí esto para las dos impresoras (Cocina y Barra/Caja).

## PASO 2 — Compartir cada impresora (esto es lo importante)

1. Andá a **Panel de Control → Dispositivos e impresoras**.
2. Click derecho sobre la impresora de Cocina → **Propiedades de impresora**.
3. Pestaña **Compartir** → tildá **"Compartir esta impresora"**.
4. En "Nombre del recurso compartido" escribí: `EPSONCOCINA` (sin espacios, así, en mayúsculas).
5. Aceptar.
6. Repetí con la otra impresora, pero el nombre del recurso compartido va a ser: `EPSONBARRA`.

> Si tu PC pide activar "Compartir impresoras y archivos" en el firewall, aceptalo —
> es solo para uso local (`localhost`), no expone nada a internet.

## PASO 3 — Verificar los nombres

Abrí PowerShell y corré:
```powershell
Get-Printer | Select Name, ShareName
```
Confirmá que ves `EPSONCOCINA` y `EPSONBARRA` en la columna `ShareName`. Si pusiste
otro nombre, editá `printers.config.json` para que coincida exactamente.

## PASO 4 — Instalar y correr el middleware

```powershell
cd printer-middleware
npm install
npm run dev
```

Te debería quedar la consola mostrando:
```
🖨️  Sazón Latino — Print Middleware escuchando en http://localhost:4000
Impresoras configuradas: cocina@EPSONCOCINA, barra@EPSONBARRA
```

Dejalo esa ventana abierta (o usá PM2 para que corra en segundo plano, ver abajo).

## PASO 5 — Probar que imprime

Con el middleware corriendo, abrí otra terminal y probá:
```powershell
curl -X POST http://localhost:4000/api/print/ticket -H "Content-Type: application/json" -d '{\"printerID\":\"cocina\",\"mesa\":1,\"items\":[{\"cantidad\":2,\"nombre\":\"Choripan\"}]}'
```
Si la impresora de Cocina tira un ticket, ¡listo! Si no, revisá que el nombre
compartido coincida exactamente con `printers.config.json`.

---

## Dejarlo arrancando solo (plug-and-play el día del evento)

Para que el mesero no tenga que abrir nada manualmente:

**Opción simple — Tarea programada de Windows:**
1. Abrí "Programador de tareas" → Crear tarea básica.
2. Desencadenador: "Al iniciar sesión".
3. Acción: Iniciar un programa → `npm.cmd` con argumentos `start` y carpeta de inicio
   apuntando a `printer-middleware`.

**Opción robusta — PM2:**
```powershell
npm install -g pm2
cd printer-middleware
npm run build
pm2 start dist/server.js --name print-mw
pm2 save
pm2 startup
```

---

## Endpoints

| Método | Ruta | Uso |
|---|---|---|
| POST | `/api/print/ticket` | Imprime comanda de cocina o barra |
| POST | `/api/print/boleta` | Imprime boleta y opcionalmente abre la gaveta |
| POST | `/api/drawer/open` | Abre la gaveta manualmente |
| GET | `/api/printers/status` | Chequea si las impresoras responden |
| POST | `/api/printers/reload` | Recarga `printers.config.json` sin reiniciar |
