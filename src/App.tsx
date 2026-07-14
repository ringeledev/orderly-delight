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
import Usuarios from "./pages/Usuarios";
import Impresoras from "./pages/Impresoras";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AuthGate = () => {
  const { user } = useAuth();
  if (!user) return <Login />;

  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route
            path="/reports"
            element={user.role === "admin" ? <Reports /> : <Dashboard />}
          />
          <Route path="/menu" element={<Menu />} />
          <Route
            path="/usuarios"
            element={user.role === "admin" ? <Usuarios /> : <Dashboard />}
          />
          <Route
            path="/impresoras"
            element={user.role === "admin" ? <Impresoras /> : <Dashboard />}
          />
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
