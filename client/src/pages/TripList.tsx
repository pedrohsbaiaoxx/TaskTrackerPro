import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Calendar, Edit, Trash2, Trash, AlertTriangle } from "lucide-react";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  TripData, 
  getAllTrips, 
  getTripsByCpf,
  deleteTrip,
  formatCurrency, 
  formatDateRange,
  getCPF,
  calculateTripSummary,
  deleteAndRecreateDB
} from "@/lib/expenseStore";
import TripModal from "@/components/TripModal";

const TripList = () => {
  const [trips, setTrips] = useState<TripData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTripModal, setShowTripModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<TripData | undefined>(undefined);
  const [tripToDelete, setTripToDelete] = useState<TripData | null>(null);
  const [tripSummaries, setTripSummaries] = useState<Record<number, { total: number, count: number }>>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  // Função para tentar sincronizar com o servidor diretamente
  const syncWithServer = async (cpf: string) => {
    try {
      console.log(`Sincronizando viagens para o CPF: ${cpf}`);
      const response = await fetch(`/api/trips/by-cpf/${cpf}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        console.warn(`Erro ao buscar viagens: ${response.status} - ${response.statusText}`);
        return;
      }
      
      const serverTrips = await response.json();
      console.log(`Encontradas ${serverTrips.length} viagens no servidor`);
      
      // Converter datas
      const formattedTrips = serverTrips.map((trip: any) => ({
        ...trip,
        createdAt: new Date(trip.createdAt || new Date()),
        startDate: trip.startDate ? new Date(trip.startDate) : null,
        endDate: trip.endDate ? new Date(trip.endDate) : null,
      }));
      
      // Atualizar a UI diretamente
      setTrips(formattedTrips);
      
      // Calcular os sumários
      const summaries: Record<number, { total: number, count: number }> = {};
      for (const trip of formattedTrips) {
        if (trip.id) {
          console.log("TripList: Calculando resumo para viagem ID:", trip.id);
          const summary = await calculateTripSummary(trip.id);
          const expenseCount = summary.total > 0 ? 1 : 0;
          summaries[trip.id] = { total: summary.total, count: expenseCount };
        }
      }
      setTripSummaries(summaries);
      
      toast({
        title: "Sincronização concluída",
        description: `${serverTrips.length} viagens carregadas do servidor`,
      });
    } catch (error) {
      console.error("Erro na sincronização direta:", error);
      toast({
        title: "Erro na sincronização",
        description: "Não foi possível sincronizar com o servidor",
        variant: "destructive",
      });
    }
  };

  const loadTrips = async () => {
    console.log("TripList: Carregando lista de viagens");
    setIsLoading(true);
    
    try {
      const cpf = await getCPF();
      console.log("TripList: CPF obtido para busca:", cpf);
      
      if (!cpf) {
        console.warn("TripList: CPF não encontrado, redirecionando para tela de autenticação");
        navigate("/auth-cpf");
        return;
      }
      
      // Tentar carregar viagens do IndexedDB primeiro
      let tripList: TripData[] = [];
      try {
        tripList = cpf ? await getTripsByCpf(cpf) : await getAllTrips();
        console.log("TripList: Viagens carregadas:", tripList.length);
        
        setTrips(tripList);
        
        // Se não há viagens no IndexedDB, tentar sincronizar com o servidor
        if (tripList.length === 0) {
          console.log("TripList: Nenhuma viagem local, tentando sincronizar do servidor");
          await syncWithServer(cpf);
        }
      } catch (localDbError) {
        console.error("Erro ao carregar viagens locais:", localDbError);
        
        // Se falhar o IndexedDB, tentar sincronizar com o servidor
        await syncWithServer(cpf);
      }
      
      if (tripList.length > 0) {
        // Load summary data for each trip
        const summaries: Record<number, { total: number, count: number }> = {};
        for (const trip of tripList) {
          if (trip.id) {
            console.log("TripList: Calculando resumo para viagem ID:", trip.id);
            const summary = await calculateTripSummary(trip.id);
            const expenseCount = summary.total > 0 ? 1 : 0; // Simplificado por enquanto
            summaries[trip.id] = { total: summary.total, count: expenseCount };
          }
        }
        setTripSummaries(summaries);
        console.log("TripList: Resumo calculado para todas as viagens");
      }
    } catch (error) {
      console.error("TripList: Erro ao carregar viagens:", error);
      toast({
        title: "Erro ao carregar viagens",
        description: "Ocorreu um erro ao carregar suas viagens",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      console.log("TripList: Carregamento concluído");
    }
  };

  useEffect(() => {
    loadTrips();
  }, []);

  useEffect(() => {
    // Check if we should open the new trip modal from URL
    if (location === "/new-trip") {
      setSelectedTrip(undefined);
      setShowTripModal(true);
    }
  }, [location]);

  const handleNewTrip = () => {
    setSelectedTrip(undefined);
    setShowTripModal(true);
    navigate("/new-trip", { replace: true });
  };

  const handleEditTrip = (trip: TripData, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTrip(trip);
    setShowTripModal(true);
  };

  const handleDeleteTrip = (trip: TripData, e: React.MouseEvent) => {
    e.stopPropagation();
    setTripToDelete(trip);
  };

  const confirmDeleteTrip = async () => {
    if (!tripToDelete?.id) return;
    
    try {
      await deleteTrip(tripToDelete.id);
      setTrips(trips.filter(t => t.id !== tripToDelete.id));
      toast({
        title: "Viagem excluída",
        description: "A viagem foi excluída com sucesso",
      });
    } catch (error) {
      console.error("Error deleting trip:", error);
      toast({
        title: "Erro ao excluir",
        description: "Ocorreu um erro ao excluir a viagem",
        variant: "destructive",
      });
    } finally {
      setTripToDelete(null);
    }
  };

  const openTrip = (trip: TripData) => {
    if (trip.id) {
      // Ao abrir uma viagem, garantimos que os dados estão sincronizados
      const cpf = trip.cpf;
      if (cpf) {
        // Fazer uma nova tentativa de sincronização em segundo plano
        syncWithServer(cpf).catch(err => 
          console.warn("Erro na sincronização de fundo:", err)
        );
      }
      
      navigate(`/trip/${trip.id}`);
    }
  };
  
  // Botão para sincronização manual
  const handleSyncClick = async () => {
    try {
      setIsLoading(true);
      toast({
        title: "Sincronizando...",
        description: "Buscando dados atualizados",
      });
      
      // Buscar CPF
      const cpf = await getCPF();
      if (!cpf) {
        toast({
          title: "Erro na sincronização",
          description: "CPF não encontrado",
          variant: "destructive",
        });
        return;
      }
      
      // Sincronizar diretamente com servidor
      await syncWithServer(cpf);
    } catch (error) {
      console.error("Erro na sincronização manual:", error);
      toast({
        title: "Erro na sincronização",
        description: "Falha ao sincronizar dados",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Função para limpar o banco de dados no servidor
  const resetServerDatabase = async () => {
    try {
      setIsResetting(true);
      toast({
        title: "Limpando banco de dados...",
        description: "Excluindo todas as viagens e despesas do servidor",
      });
      
      // Enviar solicitação para limpar o banco de dados
      const response = await fetch('/api/reset-database', {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao limpar banco de dados: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Resultado da limpeza:', result);
      
      // Limpar o IndexedDB local também
      await deleteAndRecreateDB();
      
      // Recarregar a página para reiniciar tudo
      toast({
        title: "Banco de dados limpo",
        description: `${result.trips_deleted} viagens excluídas com sucesso`,
      });
      
      // Recarregar a lista de viagens
      setTrips([]);
      setTripSummaries({});
    } catch (error) {
      console.error("Erro ao limpar banco de dados:", error);
      toast({
        title: "Erro ao limpar banco de dados",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
      setShowResetConfirm(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Minhas Viagens</h2>
        <div className="flex gap-2">
          <Button 
            onClick={handleSyncClick} 
            variant="outline" 
            className="flex items-center gap-2"
            disabled={isLoading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isLoading ? "animate-spin" : ""}>
              <path d="M21 2v6h-6"></path>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
              <path d="M3 22v-6h6"></path>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
            </svg>
            Sincronizar
          </Button>
          <Button onClick={handleNewTrip} className="flex items-center gap-2">
            <Plus size={16} /> Nova Viagem
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <Card key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-3 w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded mb-3 w-1/2"></div>
              <div className="flex items-center justify-between mt-4">
                <div>
                  <div className="h-3 bg-gray-200 rounded mb-1 w-24"></div>
                  <div className="h-5 bg-gray-200 rounded w-32"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded-full w-24"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : trips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trips.map((trip) => (
            <Card 
              key={trip.id} 
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition cursor-pointer"
              onClick={() => openTrip(trip)}
            >
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg">{trip.name}</h3>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-gray-600 h-8 w-8"
                      onClick={(e) => handleEditTrip(trip, e)}
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-rose-600 h-8 w-8"
                      onClick={(e) => handleDeleteTrip(trip, e)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center text-sm text-gray-500 mb-3">
                  <Calendar className="h-4 w-4 mr-1" />
                  <span>
                    {trip.startDate || trip.endDate 
                      ? formatDateRange(
                          trip.startDate ? new Date(trip.startDate) : null,
                          trip.endDate ? new Date(trip.endDate) : null
                        )
                      : "Sem data definida"}
                  </span>
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <span className="text-xs text-gray-500">Total de despesas</span>
                    <p className="font-mono font-medium text-lg">
                      {trip.id && tripSummaries[trip.id] 
                        ? formatCurrency(tripSummaries[trip.id]?.total || 0) 
                        : formatCurrency(0)}
                    </p>
                  </div>
                  <div className="rounded-full bg-primary/10 text-primary px-3 py-1 text-sm">
                    {trip.id && tripSummaries[trip.id] 
                      ? (tripSummaries[trip.id]?.count || 0)
                      : 0} despesas
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <i className="ri-luggage-cart-line text-primary text-2xl"></i>
          </div>
          <h3 className="text-xl font-medium mb-2">Nenhuma viagem ainda</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Comece adicionando sua primeira viagem para registrar despesas e criar relatórios automaticamente.
          </p>
          <Button onClick={handleNewTrip} className="flex items-center gap-2 mx-auto">
            <Plus size={16} /> Adicionar Viagem
          </Button>
        </div>
      )}

      {showTripModal && (
        <TripModal
          trip={selectedTrip}
          isOpen={showTripModal}
          onClose={() => {
            setShowTripModal(false);
            navigate("/", { replace: true });
          }}
          onSaved={loadTrips}
        />
      )}

      <AlertDialog open={!!tripToDelete} onOpenChange={(open) => !open && setTripToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente a viagem
              <span className="font-semibold"> {tripToDelete?.name}</span> e todas as suas despesas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTrip} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Diálogo de confirmação para limpar o banco de dados */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reiniciar sistema</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="flex items-center gap-2 text-amber-600 mb-3">
                <AlertTriangle size={20} />
                <span className="font-semibold">Atenção: Operação destrutiva</span>
              </div>
              Esta ação <span className="font-bold">não pode ser desfeita</span>. Isso excluirá permanentemente 
              <span className="font-bold"> todas as viagens e despesas</span> do banco de dados.
              <br /><br />
              Use esta opção apenas se o sistema estiver apresentando problemas graves que não podem ser resolvidos de outra maneira.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={resetServerDatabase} 
              className="bg-red-600 hover:bg-red-700"
              disabled={isResetting}
            >
              {isResetting ? 'Limpando...' : 'Limpar todos os dados'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Botão flutuante para limpar banco de dados */}
      <div className="fixed bottom-4 right-4">
        <Button 
          variant="outline" 
          size="icon"
          className="rounded-full h-10 w-10 bg-white shadow-md hover:bg-red-50 text-gray-500 hover:text-red-600"
          onClick={() => setShowResetConfirm(true)}
        >
          <Trash size={18} />
        </Button>
      </div>
    </div>
  );
};

export default TripList;
