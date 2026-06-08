import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";
import { motion } from "framer-motion";

const Login = () => {
  const { login } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleDigit = (d: string) => {
    if (pin.length < 4) {
      const newPin = pin + d;
      setPin(newPin);
      setError("");
      if (newPin.length === 4) {
        setTimeout(() => {
          const user = login(newPin);
          if (!user) {
            setError("PIN incorrecto");
            setPin("");
          }
        }, 200);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm flex flex-col items-center gap-8"
      >
        <img
          src={logo}
          alt="Sazón Latino"
          className="w-32 h-32 rounded-full shadow-2xl"
        />
        <h1 className="text-2xl font-display text-primary">Sazón Latino</h1>
        <p className="text-muted-foreground text-sm">
          Ingresa tu PIN para continuar
        </p>

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

        {error && (
          <p className="text-destructive text-sm animate-fade-in">{error}</p>
        )}

        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(String(d))}
              className="w-16 h-16 rounded-lg bg-secondary text-secondary-foreground text-xl font-semibold hover:bg-primary hover:text-primary-foreground transition-all active:scale-95"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleDelete}
            className="w-16 h-16 rounded-lg bg-secondary text-muted-foreground text-sm hover:bg-destructive hover:text-destructive-foreground transition-all"
          >
            ←
          </button>
          <button
            onClick={() => handleDigit("0")}
            className="w-16 h-16 rounded-lg bg-secondary text-secondary-foreground text-xl font-semibold hover:bg-primary hover:text-primary-foreground transition-all active:scale-95"
          >
            0
          </button>
          <div />
        </div>

        <div className="text-muted-foreground text-xs text-center mt-4 space-y-1">
          <p>Admin: 1234 | Carlos: 1111 | María: 2222</p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
