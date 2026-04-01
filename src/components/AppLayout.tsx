import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink, useLocation } from "react-router-dom";
import logo from "@/assets/logo.png";
import { LayoutDashboard, ClipboardList, BarChart3, LogOut, UtensilsCrossed } from "lucide-react";

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const links = [
    { to: "/", icon: LayoutDashboard, label: "Mesas" },
    { to: "/orders", icon: ClipboardList, label: "Pedidos" },
    ...(user?.role === "admin" ? [{ to: "/reports", icon: BarChart3, label: "Reportes" }] : []),
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
            <p className="text-muted-foreground text-xs">{user?.name} • {user?.role === "admin" ? "Admin" : "Mesero"}</p>
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
            onClick={logout}
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
          <button onClick={logout} className="text-muted-foreground p-2">
            <LogOut size={18} />
          </button>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
        {/* Mobile nav */}
        <nav className="md:hidden flex border-t border-border bg-card">
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
    </div>
  );
};

export default AppLayout;
