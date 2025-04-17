import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Calendar, Edit, Trash2 } from "lucide-react";
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
  calculateTripSummary
} from "@/lib/expenseStore";
import TripModal from "@/components/TripModal";

const TripList = () => {
  const [trips, setTrips] = useState<TripData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTripModal, setShowTripModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<TripData | undefined>(undefined);
  const [tripToDelete, setTripToDelete] = useState<TripData | null>(null);
  const [tripSummaries, setTripSummaries] = useState<Record<number, { total: number, count: number }>>({});
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  const loadTrips = async () => {
    setIsLoading(true);
    try {
      const cpf = await getCPF();
      const tripList = cpf ? await getTripsByCpf(cpf) : await getAllTrips();
      setTrips(tripList);
      
      // Load summary data for each trip
      const summaries: Record<number, { total: number, count: number }> = {};
      for (const trip of tripList) {
        if (trip.id) {
          const summary = await calculateTripSummary(trip.id);
          const expenseCount = summary.total > 0 ? 1 : 0; // Simplified for now
          summaries[trip.id] = { total: summary.total, count: expenseCount };
        }
      }
      setTripSummaries(summaries);
    } catch (error) {
      console.error("Error loading trips:", error);
      toast({
        title: "Erro ao carregar viagens",
        description: "Ocorreu um erro ao carregar suas viagens",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
      navigate(`/trip/${trip.id}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Minhas Viagens</h2>
        <Button onClick={handleNewTrip} className="flex items-center gap-2">
          <Plus size={16} /> Nova Viagem
        </Button>
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
                        ? formatCurrency(tripSummaries[trip.id].total) 
                        : formatCurrency(0)}
                    </p>
                  </div>
                  <div className="rounded-full bg-primary/10 text-primary px-3 py-1 text-sm">
                    {trip.id && tripSummaries[trip.id] 
                      ? tripSummaries[trip.id].count 
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
    </div>
  );
};

export default TripList;
