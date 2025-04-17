import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import TripList from "@/pages/TripList";
import ExpenseList from "@/pages/ExpenseList";
import NotFound from "@/pages/not-found";
import CpfModal from "@/components/CpfModal";
import { useToast } from "@/hooks/use-toast";
import { getCPF, saveCPF } from "@/lib/expenseStore";

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
  const [location] = useLocation();
  const [, navigate] = useLocation();

  const handleClick = () => {
    if (location.startsWith("/trip/")) {
      // Show new expense modal
      const tripId = location.split("/").pop();
      navigate(`/trip/${tripId}/new-expense`);
    } else {
      // Show new trip modal
      navigate("/new-trip");
    }
  };

  return (
    <nav className="bg-white shadow-md md:hidden z-10">
      <div className="container mx-auto">
        <div className="flex justify-center">
          <button 
            onClick={handleClick}
            className="bg-primary text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg fixed bottom-20 z-20"
          >
            <i className="ri-add-line text-2xl"></i>
          </button>
        </div>
      </div>
    </nav>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={TripList} />
      <Route path="/new-trip" component={TripList} />
      <Route path="/trip/:id" component={ExpenseList} />
      <Route path="/trip/:id/new-expense" component={ExpenseList} />
      <Route path="/trip/:id/edit-expense/:expenseId" component={ExpenseList} />
      <Route path="/trip/:id/view-receipt/:expenseId" component={ExpenseList} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col h-screen">
        <Header />
        <main className="flex-1 overflow-auto">
          <Router />
        </main>
        <MobileAddButton />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
