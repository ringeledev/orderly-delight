import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Reports from "./pages/Reports";
import Menu from "./pages/Menu";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";
import Mesas from "./pages/Mesas"; 

const queryClient = new QueryClient();

const AuthGate = () => {
  const { user } = useAuth();
  if (!user) return <Login />;
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          {/* Cambiamos la raíz para que use tus nuevas Mesas con botones */}
          <Route path="/" element={<Mesas />} />
          
          {/* Conservamos las demás rutas del sistema */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/reports" element={user.role === "admin" ? <Reports /> : <Mesas />} />
          <Route path="/menu" element={<Menu />} />
          
          {/* Si ninguna ruta coincide, muestra error 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
};
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
