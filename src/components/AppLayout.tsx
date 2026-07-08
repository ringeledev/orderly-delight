import { ReactNode, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink, useLocation } from "react-router-dom";
import logo from "@/assets/logo.png";
import { LayoutDashboard, ClipboardList, BarChart3, LogOut, UtensilsCrossed, Users } from "lucide-react";

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const links = [
    { to: "/", icon: LayoutDashboard, label: "Mesas" },
    { to: "/orders", icon: ClipboardList, label: "Pedidos" },
    ...(user?.role === "admin" ? [
      { to: "/reports", icon: BarChart3, label: "Reportes" },
      { to: "/usuarios", icon: Users, label: "Usuarios" },
    ] : []),
    { to: "/menu", icon: UtensilsCrossed, label: "Menú" },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col shrink-0 hidden md:flex">
        <div className="p-4 flex items-center gap-3 border-b border-border">
          <img src={logo} alt="Logo" className="w-10 h-10 rounded-full" />
          <div>
            <p className="font-display text-primary text-sm">Sazón Latino</p>
            <p className="text-muted-foreground text-xs">{user?.name} • {user?.role === "admin" ? "Admin" : "Mesero/a"}</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={() =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  location.pathname === link.to
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`
              }
            >
              <link.icon size={18} />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <button
            onClick={() => setConfirmLogout(true)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-all w-full"
          >
            <LogOut size={18} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between p-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="w-8 h-8 rounded-full" />
            <span className="font-display text-primary text-sm">Sazón Latino</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-foreground text-xs font-medium">{user?.name}</p>
              <p className="text-muted-foreground text-xs">{user?.role === "admin" ? "Admin" : "Mesero/a"}</p>
            </div>
            <button onClick={() => setConfirmLogout(true)} className="text-muted-foreground p-2">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
        {/* Mobile nav */}
        <nav className="md:hidden flex border-t border-border bg-card sticky bottom-0 z-50">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={() =>
                `flex-1 flex flex-col items-center py-2 text-xs transition-all ${
                  location.pathname === link.to ? "text-primary" : "text-muted-foreground"
                }`
              }
            >
              <link.icon size={20} />
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
      {confirmLogout && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4 text-center">
            <LogOut size={32} className="mx-auto text-primary" />
            <p className="font-display text-lg text-primary">¿Cerrar sesión?</p>
            <p className="text-muted-foreground text-sm">¿Estás seguro que querés salir?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmLogout(false)}
                className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-secondary transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setConfirmLogout(false); logout(); }}
                className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-all"
              >
                Sí, salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppLayout;
