import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { TripData, saveTrip, updateTrip, getCPF } from "@/lib/expenseStore";

interface TripModalProps {
  trip?: TripData;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const TripModal = ({ trip, isOpen, onClose, onSaved }: TripModalProps) => {
  const [name, setName] = useState(trip?.name || "");
  const [startDate, setStartDate] = useState<string>(
    trip?.startDate ? new Date(trip.startDate).toISOString().split("T")[0] : ""
  );
  const [endDate, setEndDate] = useState<string>(
    trip?.endDate ? new Date(trip.endDate).toISOString().split("T")[0] : ""
  );
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const isEditing = !!trip?.id;

  useEffect(() => {
    if (isOpen) {
      setName(trip?.name || "");
      setStartDate(trip?.startDate ? new Date(trip.startDate).toISOString().split("T")[0] : "");
      setEndDate(trip?.endDate ? new Date(trip.endDate).toISOString().split("T")[0] : "");
    }
  }, [isOpen, trip]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome da viagem é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get current CPF if available
      const cpf = await getCPF();
      
      const tripData = {
        name,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        cpf: cpf,
      };

      if (isEditing && trip.id) {
        await updateTrip(trip.id, tripData);
        toast({
          title: "Viagem atualizada",
          description: "A viagem foi atualizada com sucesso",
        });
      } else {
        await saveTrip(tripData);
        toast({
          title: "Viagem criada",
          description: "A nova viagem foi criada com sucesso",
        });
      }

      onSaved();
      onClose();
      navigate("/");
    } catch (error) {
      console.error("Error saving trip:", error);
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar a viagem",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Viagem" : "Nova Viagem"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="trip-name">Nome da Viagem</Label>
              <Input
                id="trip-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Viagem São Paulo - Out/2023"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="trip-start-date">Data de Início</Label>
                <Input
                  id="trip-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="trip-end-date">Data de Fim</Label>
                <Input
                  id="trip-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">{isEditing ? "Atualizar" : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TripModal;
