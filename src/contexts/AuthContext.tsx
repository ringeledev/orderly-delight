import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { loginWithPin, verifySession, type ProfileUser } from "@/services/db";

interface AuthContextType {
  user: ProfileUser | null;
  login: (pin: string) => Promise<ProfileUser | null>;
  logout: () => void;
}

const AUTH_KEY = "sazon_current_user";

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

function getPersistedUser(): ProfileUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<ProfileUser | null>(getPersistedUser);
  const [kicked, setKicked] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setUser(null);
    setKicked(false);
  }, []);

  const login = useCallback(async (pin: string): Promise<ProfileUser | null> => {
    const profile = await loginWithPin(pin);
    if (profile) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(profile));
      setUser(profile);
      setKicked(false);
    }
    return profile;
  }, []);

  // Verify session every 30s — if token changed (another device logged in), force logout
  useEffect(() => {
    if (!user?.sessionToken) return;

    const check = async () => {
      const valid = await verifySession(user.id, user.sessionToken!);
      if (!valid) {
        localStorage.removeItem(AUTH_KEY);
        setUser(null);
        setKicked(true);
      }
    };

    check();
    const interval = setInterval(check, 30000);

    const onFocus = () => check();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [user?.id, user?.sessionToken]);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {kicked && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 text-center space-y-3">
            <p className="text-2xl">⚠️</p>
            <p className="font-display text-primary text-lg">Sesión cerrada</p>
            <p className="text-muted-foreground text-sm">
              Tu sesión fue cerrada porque el usuario inició sesión en otro dispositivo.
            </p>
            <button
              onClick={() => setKicked(false)}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
};
