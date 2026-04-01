import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { store, User } from "@/lib/store";

interface AuthContextType {
  user: User | null;
  login: (pin: string) => User | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(store.getCurrentUser());

  const login = useCallback((pin: string) => {
    const u = store.login(pin);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    store.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
