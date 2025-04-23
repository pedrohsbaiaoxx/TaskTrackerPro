import { useState, useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Loader2 } from "lucide-react";
import TripList from "@/pages/TripList";
import ExpenseList from "@/pages/ExpenseList";
import NotFound from "@/pages/not-found";
import AuthPageCpf from "@/pages/auth-page-cpf";
import RedirectToAuth from "@/pages/Redirect";
import CpfModal from "@/components/CpfModal";
import { useToast } from "@/hooks/use-toast";
import { getCPF, saveCPF } from "@/lib/expenseStore";
import { ProtectedRoute } from "@/lib/protected-route";

function Header() {
  const [location, setLocation] = useState("/");
  const [showCpfModal, setShowCpfModal] = useState(false);
  const [cpf, setCpf] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadCpf = async () => {
      const savedCpf = await getCPF();
      setCpf(savedCpf);
    };
    loadCpf();
  }, []);

  const handleSaveCpf = async (newCpf: string) => {
    await saveCPF(newCpf);
    setCpf(newCpf);
    setShowCpfModal(false);
    toast({
      title: "CPF salvo",
      description: "Suas viagens agora estão associadas a este CPF",
    });
  };

  return (
    <>
      <header className="bg-primary shadow-md z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-white text-xl font-semibold tracking-wide">ExpenseTracker</h1>
          <div>
            <button 
              onClick={() => setShowCpfModal(true)}
              className="bg-white/20 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-white/30 transition flex items-center"
            >
              <i className="ri-user-line mr-1"></i> 
              <span>{cpf || "Identificar CPF"}</span>
            </button>
          </div>
        </div>
      </header>

      {showCpfModal && (
        <CpfModal 
          currentCpf={cpf} 
          onSave={handleSaveCpf} 
          onClose={() => setShowCpfModal(false)} 
        />
      )}
    </>
  );
}

function MobileAddButton() {
  // Componente removido conforme solicitado
  return null;
}

function Router() {
  const [cpf, setCpf] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedCpf = await getCPF();
        setCpf(storedCpf);
      } catch (error) {
        console.error("Erro ao verificar CPF:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  
  // Se já estiver autenticado e estiver na página inicial, redirecionar para dashboard
  if (cpf && window.location.pathname === "/") {
    return <Redirect to="/dashboard" />;
  }
  
  return (
    <Switch>
      <Route path="/" component={cpf ? TripList : RedirectToAuth} />
      <ProtectedRoute path="/dashboard" component={TripList} />
      <ProtectedRoute path="/new-trip" component={TripList} />
      <ProtectedRoute path="/trip/:id" component={ExpenseList} />
      <ProtectedRoute path="/trip/:id/new-expense" component={ExpenseList} />
      <ProtectedRoute path="/trip/:id/edit-expense/:expenseId" component={ExpenseList} />
      <ProtectedRoute path="/trip/:id/view-receipt/:expenseId" component={ExpenseList} />
      <Route path="/auth" component={AuthPageCpf} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppHeader({ showHeader }: { showHeader: boolean }) {
  return showHeader ? <Header /> : null;
}

function AppMobileButton({ showButton }: { showButton: boolean }) {
  return showButton ? <MobileAddButton /> : null;
}

function App() {
  const [location] = useLocation();
  const isAuthPage = location === "/auth" || location === "/auth-cpf";

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col h-screen">
        <AppHeader showHeader={!isAuthPage} />
        <main className={`flex-1 overflow-auto ${isAuthPage ? 'p-0' : ''}`}>
          <Router />
        </main>
        <AppMobileButton showButton={!isAuthPage} />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
