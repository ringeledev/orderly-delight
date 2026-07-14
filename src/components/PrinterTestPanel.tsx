import { useState, useEffect } from "react";
import { Printer, Wifi, WifiOff, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chequearImpresoras } from "@/services/print";

const PRINT_URL = import.meta.env.VITE_PRINT_MIDDLEWARE_URL ?? "http://localhost:4000";

interface PrinterStatus {
  id: string;
  nombre: string;
  online: boolean;
}

const PrinterTestPanel = () => {
  const [impresoras, setImpresoras] = useState<PrinterStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [middlewareOk, setMiddlewareOk] = useState<boolean | null>(null);
  const [testResult, setTestResult] = useState<Record<string, "ok" | "error" | null>>({});

  const checkStatus = async () => {
    setLoading(true);
    setMiddlewareOk(null);
    try {
      const data = await chequearImpresoras();
      if (data.length > 0) {
        setMiddlewareOk(true);
        setImpresoras(data);
      } else {
        setMiddlewareOk(false);
        setImpresoras([]);
      }
    } catch {
      setMiddlewareOk(false);
      setImpresoras([]);
    } finally {
      setLoading(false);
    }
  };

  const testPrint = async (printerID: string) => {
    setTestResult((prev) => ({ ...prev, [printerID]: null }));
    try {
      const res = await fetch(`${PRINT_URL}/api/print/ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printerID,
          mesa: 0,
          lider: "Prueba",
          mesero: "Admin",
          items: [{ cantidad: 1, nombre: "*** PRUEBA DE IMPRESORA ***" }],
        }),
      });
      const data = await res.json();
      setTestResult((prev) => ({ ...prev, [printerID]: data.success ? "ok" : "error" }));
    } catch {
      setTestResult((prev) => ({ ...prev, [printerID]: "error" }));
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Printer size={18} className="text-primary" />
          <h3 className="font-display text-primary text-base">Impresoras</h3>
        </div>
        <Button size="sm" variant="outline" onClick={checkStatus} disabled={loading}>
          <RefreshCw size={13} className={`mr-1 ${loading ? "animate-spin" : ""}`} />
          Verificar
        </Button>
      </div>

      {/* Estado del middleware */}
      <div className="flex items-center gap-2 text-sm">
        {middlewareOk === null ? (
          <span className="text-muted-foreground">Verificando conexión...</span>
        ) : middlewareOk ? (
          <>
            <CheckCircle size={14} className="text-green-500" />
            <span className="text-green-500">Servidor de impresión conectado</span>
          </>
        ) : (
          <>
            <XCircle size={14} className="text-destructive" />
            <span className="text-destructive">Servidor de impresión no disponible</span>
            <span className="text-muted-foreground text-xs">— ¿Está encendida la PC con el middleware?</span>
          </>
        )}
      </div>

      {/* Lista de impresoras */}
      {impresoras.length > 0 && (
        <div className="space-y-2">
          {impresoras.map((imp) => (
            <div
              key={imp.id}
              className="flex items-center justify-between border border-border rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                {imp.online ? (
                  <Wifi size={14} className="text-green-500" />
                ) : (
                  <WifiOff size={14} className="text-destructive" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{imp.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {imp.online ? "En línea" : "Sin conexión"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {testResult[imp.id] === "ok" && (
                  <span className="text-xs text-green-500 flex items-center gap-1">
                    <CheckCircle size={12} /> Imprimido
                  </span>
                )}
                {testResult[imp.id] === "error" && (
                  <span className="text-xs text-destructive flex items-center gap-1">
                    <XCircle size={12} /> Error
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!imp.online}
                  onClick={() => testPrint(imp.id)}
                >
                  <Printer size={12} className="mr-1" /> Probar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PrinterTestPanel;
