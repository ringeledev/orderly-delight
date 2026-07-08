import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const Login = () => {
  const { login } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDigit = async (d: string) => {
    if (pin.length >= 4 || loading) return;
    const newPin = pin + d;
    setPin(newPin);
    setError("");

    if (newPin.length === 4) {
      setLoading(true);
      try {
        const user = await login(newPin);
        if (!user) {
          setError("PIN incorrecto");
          setPin("");
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDelete = () => {
    if (loading) return;
    setPin(pin.slice(0, -1));
    setError("");
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading) return;
      if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
      else if (e.key === "Backspace") handleDelete();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pin, loading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm flex flex-col items-center gap-8"
      >
        <img src={logo} alt="Sazón Latino" className="w-32 h-32 rounded-full shadow-2xl" />
        <h1 className="text-2xl font-display text-primary">Sazón Latino</h1>
        <p className="text-muted-foreground text-sm">Ingresa tu PIN para continuar</p>

        <div className="flex gap-3 mb-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 border-primary transition-all ${
                i < pin.length ? "bg-primary scale-110" : "bg-transparent"
              }`}
            />
          ))}
        </div>

        {loading && <Loader2 className="animate-spin text-primary" size={20} />}
        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(String(d))}
              disabled={loading}
              className="w-16 h-16 rounded-lg bg-secondary text-secondary-foreground text-xl font-semibold hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleDelete}
            disabled={loading}
            className="w-16 h-16 rounded-lg bg-secondary text-muted-foreground text-sm hover:bg-destructive hover:text-destructive-foreground transition-all disabled:opacity-50"
          >
            ←
          </button>
          <button
            onClick={() => handleDigit("0")}
            disabled={loading}
            className="w-16 h-16 rounded-lg bg-secondary text-secondary-foreground text-xl font-semibold hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
          >
            0
          </button>
          <div />
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
