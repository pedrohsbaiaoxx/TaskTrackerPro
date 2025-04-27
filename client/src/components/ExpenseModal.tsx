import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ExpenseData, saveExpense, updateExpense, formatCurrency } from "@/lib/expenseStore";
import { syncExpenseToServer, updateExpenseOnServer } from "@/lib/syncService";

// Função auxiliar para formatar a data corretamente (sem UTC)
function formatDateToInput(dateStr?: string | Date) {
  if (!dateStr) return format(new Date(), "yyyy-MM-dd");
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Função para criar uma data sem problemas de fuso horário
function parseDateWithoutTimezone(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day); // mês começa do zero
}

interface ExpenseModalProps {
  tripId: number;
  expense?: ExpenseData;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const MILEAGE_RATE = 1.09;

const ExpenseModal = ({ tripId, expense, isOpen, onClose, onSaved }: ExpenseModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false); // Estado para controlar o botão de salvar
  const [date, setDate] = useState<string>(
    expense?.date ? formatDateToInput(expense.date) : formatDateToInput(new Date())
  );
  const [destination, setDestination] = useState(expense?.destination || "");
  const [justification, setJustification] = useState(expense?.justification || "");
  
  // Expense values - mantendo a mesma sequência da planilha
  const [breakfastValue, setBreakfastValue] = useState(expense?.breakfastValue || "");
  const [lunchValue, setLunchValue] = useState(expense?.lunchValue || "");
  const [dinnerValue, setDinnerValue] = useState(expense?.dinnerValue || "");  
  const [transportValue, setTransportValue] = useState(expense?.transportValue || "");
  const [parkingValue, setParkingValue] = useState(expense?.parkingValue || "");
  const [mileage, setMileage] = useState(expense?.mileage ? expense.mileage.toString() : "");
  const [mileageValue, setMileageValue] = useState(expense?.mileageValue || "");
  const [otherValue, setOtherValue] = useState(expense?.otherValue || "");
  const [otherDescription, setOtherDescription] = useState(expense?.otherDescription || "");
  
  // Receipt
  const [receiptBase64, setReceiptBase64] = useState<string | null>(expense?.receipt || null);
  const [totalValue, setTotalValue] = useState(expense?.totalValue || "0");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isEditing = !!expense?.id;

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, expense]);

  const resetForm = () => {
    setDate(
      expense?.date
        ? formatDateToInput(expense.date)
        : formatDateToInput(new Date())
    );
    setDestination(expense?.destination || "");
    setJustification(expense?.justification || "");
    setBreakfastValue(expense?.breakfastValue || "");
    setLunchValue(expense?.lunchValue || "");
    setDinnerValue(expense?.dinnerValue || "");
    setTransportValue(expense?.transportValue || "");
    setParkingValue(expense?.parkingValue || "");
    setMileage(expense?.mileage ? expense.mileage.toString() : "");
    setMileageValue(expense?.mileageValue || "");
    setOtherValue(expense?.otherValue || "");
    setOtherDescription(expense?.otherDescription || "");
    setReceiptBase64(expense?.receipt || null);
  };


  // Update mileage value when mileage changes
  useEffect(() => {
    const km = parseFloat(mileage) || 0;
    const value = (km * MILEAGE_RATE).toFixed(2);
    setMileageValue(value);
  }, [mileage]);

  // Calculate total value and create derived mealValue
  useEffect(() => {
    const breakfast = parseFloat(breakfastValue) || 0;
    const lunch = parseFloat(lunchValue) || 0;
    const dinner = parseFloat(dinnerValue) || 0;
    const transport = parseFloat(transportValue) || 0;
    const parking = parseFloat(parkingValue) || 0;
    const mileageValueFloat = parseFloat(mileageValue) || 0;
    const other = parseFloat(otherValue) || 0;
    
    // Total de refeições para compatibilidade com o campo legacy
    const mealTotal = breakfast + lunch + dinner;
    
    const total = breakfast + lunch + dinner + transport + parking + mileageValueFloat + other;
    setTotalValue(total.toFixed(2));
  }, [breakfastValue, lunchValue, dinnerValue, transportValue, parkingValue, mileageValue, otherValue]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 5MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setReceiptBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Se já estiver submetendo, não faz nada (evita cliques múltiplos)
    if (isSubmitting) {
      return;
    }
    
    // Ativa o estado de submissão para desabilitar o botão
    setIsSubmitting(true);
    
    if (!destination.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O destino é obrigatório",
        variant: "destructive",
      });
      setIsSubmitting(false); // Reativa o botão
      return;
    }

    if (!justification.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "A justificativa é obrigatória",
        variant: "destructive",
      });
      setIsSubmitting(false); // Reativa o botão
      return;
    }

    if (!receiptBase64) {
      toast({
        title: "Anexo obrigatório",
        description: "É necessário anexar uma imagem da nota fiscal",
        variant: "destructive",
      });
      setIsSubmitting(false); // Reativa o botão
      return;
    }

    try {
      const breakfast = parseFloat(breakfastValue) || 0;
      const lunch = parseFloat(lunchValue) || 0;
      const dinner = parseFloat(dinnerValue) || 0;
      const mealTotal = (breakfast + lunch + dinner).toFixed(2);
      
      const now = new Date();
      const expenseData = {
        tripId,
        date: parseDateWithoutTimezone(date),
        destination,
        justification,
        breakfastValue,
        lunchValue,
        dinnerValue,
        transportValue,
        parkingValue,
        mileage: mileage ? parseInt(mileage) : 0,
        mileageValue,
        otherValue,
        otherDescription,
        receipt: receiptBase64,
        totalValue,
        // Para compatibilidade com código legado
        mealValue: mealTotal,
        // Campos necessários para o TypeScript e banco de dados
        updatedAt: now
      };

      if (isEditing && expense.id) {
        // Primeiro atualizamos localmente
        await updateExpense(expense.id, expenseData);
        
        // Agora enviamos a atualização para o servidor
        try {
          const now = new Date();
          const syncResult = await updateExpenseOnServer(expense.id, {
            ...expenseData,
            id: expense.id,
            createdAt: expense.createdAt || now,
            updatedAt: now
          });
          
          if (syncResult) {
            toast({
              title: "Despesa atualizada",
              description: "A despesa foi atualizada e sincronizada com o servidor",
            });
          } else {
            toast({
              title: "Atualização parcial",
              description: "A despesa foi atualizada localmente, mas houve erro na sincronização com o servidor",
              variant: "destructive"
            });
          }
        } catch (syncError) {
          console.error("Erro na sincronização da atualização:", syncError);
          toast({
            title: "Sincronização falhou",
            description: "A despesa foi atualizada localmente, mas a sincronização falhou",
            variant: "destructive"
          });
        }
      } else {
        // Primeiro salvamos no IndexedDB local para ter um ID
        const localId = await saveExpense(expenseData);
        
        // Agora enviamos para o servidor
        try {
          // Adicionamos o ID local para possibilitar rastreamento depois
          const now = new Date();
          const syncResult = await syncExpenseToServer({
            ...expenseData,
            id: localId,
            createdAt: now,
            updatedAt: now
          });
          
          if (syncResult) {
            toast({
              title: "Despesa criada",
              description: "A despesa foi criada e sincronizada com o servidor",
            });
          } else {
            toast({
              title: "Despesa criada localmente",
              description: "A despesa foi salva localmente, mas houve erro na sincronização com o servidor",
              variant: "destructive"
            });
          }
        } catch (syncError) {
          console.error("Erro na sincronização:", syncError);
          toast({
            title: "Sincronização falhou",
            description: "A despesa foi salva localmente, mas não foi enviada ao servidor",
            variant: "destructive"
          });
        }
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error("Error saving expense:", error);
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar a despesa",
        variant: "destructive",
      });
      setIsSubmitting(false); // Reativa o botão em caso de erro
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="expense-date">Data da Despesa</Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expense-destination">Destino</Label>
                <Input
                  id="expense-destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Ex: Aeroporto"
                  required
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="expense-justification">Justificativa da Despesa</Label>
              <Textarea
                id="expense-justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Explique o motivo desta despesa"
                required
                rows={2}
              />
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-3">Valores</h3>
              
              {/* Refeições */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="grid gap-2">
                  <Label htmlFor="expense-breakfast">Café da manhã (R$)</Label>
                  <Input
                    id="expense-breakfast"
                    type="number"
                    min="0"
                    step="0.01"
                    value={breakfastValue}
                    onChange={(e) => setBreakfastValue(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expense-lunch">Almoço (R$)</Label>
                  <Input
                    id="expense-lunch"
                    type="number"
                    min="0"
                    step="0.01"
                    value={lunchValue}
                    onChange={(e) => setLunchValue(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expense-dinner">Jantar (R$)</Label>
                  <Input
                    id="expense-dinner"
                    type="number"
                    min="0"
                    step="0.01"
                    value={dinnerValue}
                    onChange={(e) => setDinnerValue(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>
              
              {/* Transporte */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="grid gap-2">
                  <Label htmlFor="expense-transport">Taxi/Uber (R$)</Label>
                  <Input
                    id="expense-transport"
                    type="number"
                    min="0"
                    step="0.01"
                    value={transportValue}
                    onChange={(e) => setTransportValue(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expense-parking">Estacionamento/Pedágio (R$)</Label>
                  <Input
                    id="expense-parking"
                    type="number"
                    min="0"
                    step="0.01"
                    value={parkingValue}
                    onChange={(e) => setParkingValue(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>
              
              {/* Quilometragem e outros */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="grid gap-2">
                  <Label htmlFor="expense-mileage">KM rodado</Label>
                  <div className="flex">
                    <Input
                      id="expense-mileage"
                      type="number"
                      min="0"
                      value={mileage}
                      onChange={(e) => setMileage(e.target.value)}
                      placeholder="0"
                      className="rounded-r-none"
                    />
                    <div className="bg-gray-100 flex items-center justify-center border border-input border-l-0 rounded-r-md px-3 text-gray-700 text-sm w-1/3">
                      {formatCurrency(mileageValue)}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Valor por KM: R$ 1,09</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expense-other">Outros gastos (R$)</Label>
                  <Input
                    id="expense-other"
                    type="number"
                    min="0"
                    step="0.01"
                    value={otherValue}
                    onChange={(e) => setOtherValue(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>
              
              {/* Descrição de outros */}
              <div className="grid gap-2">
                <Label htmlFor="expense-other-description">Descrição outros gastos</Label>
                <Input
                  id="expense-other-description"
                  value={otherDescription}
                  onChange={(e) => setOtherDescription(e.target.value)}
                  placeholder="Descrição do gasto"
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label>Anexo da Nota Fiscal</Label>
              
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {!receiptBase64 ? (
                  <div className="flex flex-col items-center">
                    <i className="ri-upload-cloud-line text-3xl text-gray-400 mb-2"></i>
                    <p className="text-gray-600 mb-1">Clique para selecionar ou arraste uma imagem</p>
                    <p className="text-xs text-gray-500">JPG, PNG ou PDF (máx. 5MB)</p>
                  </div>
                ) : (
                  <div>
                    <img 
                      src={receiptBase64} 
                      alt="Comprovante" 
                      className="max-h-40 mx-auto rounded-lg shadow-sm mb-2" 
                    />
                    <Button 
                      type="button" 
                      variant="link" 
                      className="text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Alterar imagem
                    </Button>
                  </div>
                )}
                
                <Input
                  ref={fileInputRef}
                  id="receipt-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="font-medium">
              Total: <span className="font-mono">{formatCurrency(totalValue)}</span>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isEditing ? "Atualizando..." : "Salvando..."}
                  </>
                ) : (
                  isEditing ? "Atualizar" : "Salvar"
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseModal;
