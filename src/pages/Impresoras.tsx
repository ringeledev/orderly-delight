import PrinterTestPanel from "@/components/PrinterTestPanel";

const Impresoras = () => {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display text-primary">Impresoras</h1>
        <p className="text-muted-foreground text-sm">Verificá el estado y probá las impresoras</p>
      </div>
      <PrinterTestPanel />
    </div>
  );
};

export default Impresoras;
