import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  FileText, 
  FileSpreadsheet,
  Edit, 
  Trash2 
} from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { 
  TripData, 
  ExpenseData,
  ExpenseSummary,
  getTrip, 
  getExpensesByTrip,
  deleteExpense,
  formatCurrency,
  formatDateRange,
  calculateTripSummary,
  getExpense
} from "@/lib/expenseStore";
import ExpenseModal from "@/components/ExpenseModal";
import ReceiptPreviewModal from "@/components/ReceiptPreviewModal";

const ExpenseList = () => {
  const [location, navigate] = useLocation();
  const [trip, setTrip] = useState<TripData | null>(null);
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({
    meals: 0,
    transport: 0,
    parking: 0,
    mileage: 0,
    other: 0,
    total: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseData | undefined>(undefined);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseData | null>(null);
  
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  
  const { toast } = useToast();
  
  // Get trip ID from URL
  const tripId = parseInt(location.split("/")[2], 10);
  
  const loadTripAndExpenses = async () => {
    setIsLoading(true);
    try {
      // Load trip data
      const tripData = await getTrip(tripId);
      if (!tripData) {
        toast({
          title: "Viagem não encontrada",
          description: "A viagem solicitada não foi encontrada",
          variant: "destructive",
        });
        navigate("/");
        return;
      }
      setTrip(tripData);
      
      // Load expenses
      const expenseList = await getExpensesByTrip(tripId);
      setExpenses(expenseList);
      
      // Calculate summary
      const summaryData = await calculateTripSummary(tripId);
      setSummary(summaryData);
    } catch (error) {
      console.error("Error loading trip data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Ocorreu um erro ao carregar os dados da viagem",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadTripAndExpenses();
  }, [tripId]);
  
  useEffect(() => {
    // Check if we should open expense modal from URL
    if (location.includes("/new-expense")) {
      setSelectedExpense(undefined);
      setShowExpenseModal(true);
    } else if (location.includes("/edit-expense/")) {
      const expenseId = parseInt(location.split("/").pop() || "0", 10);
      if (expenseId) {
        loadExpenseForEdit(expenseId);
      }
    } else if (location.includes("/view-receipt/")) {
      const expenseId = parseInt(location.split("/").pop() || "0", 10);
      if (expenseId) {
        loadReceiptForPreview(expenseId);
      }
    }
  }, [location]);
  
  const loadExpenseForEdit = async (expenseId: number) => {
    try {
      const expense = await getExpense(expenseId);
      if (expense && expense.tripId === tripId) {
        setSelectedExpense(expense);
        setShowExpenseModal(true);
      } else {
        toast({
          title: "Despesa não encontrada",
          description: "A despesa solicitada não foi encontrada",
          variant: "destructive",
        });
        navigate(`/trip/${tripId}`);
      }
    } catch (error) {
      console.error("Error loading expense:", error);
      toast({
        title: "Erro ao carregar despesa",
        description: "Ocorreu um erro ao carregar os dados da despesa",
        variant: "destructive",
      });
    }
  };
  
  const loadReceiptForPreview = async (expenseId: number) => {
    try {
      const expense = await getExpense(expenseId);
      if (expense && expense.tripId === tripId) {
        setReceiptUrl(expense.receipt);
        setShowReceiptModal(true);
      } else {
        toast({
          title: "Comprovante não encontrado",
          description: "O comprovante solicitado não foi encontrado",
          variant: "destructive",
        });
        navigate(`/trip/${tripId}`);
      }
    } catch (error) {
      console.error("Error loading receipt:", error);
      toast({
        title: "Erro ao carregar comprovante",
        description: "Ocorreu um erro ao carregar o comprovante",
        variant: "destructive",
      });
    }
  };
  
  const handleNewExpense = () => {
    setSelectedExpense(undefined);
    setShowExpenseModal(true);
    navigate(`/trip/${tripId}/new-expense`, { replace: true });
  };
  
  const handleEditExpense = (expense: ExpenseData, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedExpense(expense);
    setShowExpenseModal(true);
    navigate(`/trip/${tripId}/edit-expense/${expense.id}`, { replace: true });
  };
  
  const handleDeleteExpense = (expense: ExpenseData, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpenseToDelete(expense);
  };
  
  const confirmDeleteExpense = async () => {
    if (!expenseToDelete?.id) return;
    
    try {
      await deleteExpense(expenseToDelete.id);
      setExpenses(expenses.filter(e => e.id !== expenseToDelete.id));
      loadTripAndExpenses(); // Reload to update summary
      toast({
        title: "Despesa excluída",
        description: "A despesa foi excluída com sucesso",
      });
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast({
        title: "Erro ao excluir",
        description: "Ocorreu um erro ao excluir a despesa",
        variant: "destructive",
      });
    } finally {
      setExpenseToDelete(null);
    }
  };
  
  const viewReceipt = (expense: ExpenseData) => {
    setReceiptUrl(expense.receipt);
    setShowReceiptModal(true);
    navigate(`/trip/${tripId}/view-receipt/${expense.id}`, { replace: true });
  };
  
  const goBack = () => {
    navigate("/");
  };
  
  const getExpenseTypeLabel = (expense: ExpenseData): { label: string, bgColor: string } => {
    if (expense.mealValue && parseFloat(expense.mealValue) > 0) {
      return { label: "Refeição", bgColor: "bg-blue-100 text-blue-800" };
    }
    if (expense.transportValue && parseFloat(expense.transportValue) > 0) {
      return { label: "Transporte", bgColor: "bg-green-100 text-green-800" };
    }
    if (expense.mileage && expense.mileage > 0) {
      return { label: "KM rodado", bgColor: "bg-purple-100 text-purple-800" };
    }
    if (expense.parkingValue && parseFloat(expense.parkingValue) > 0) {
      return { label: "Estacionamento", bgColor: "bg-amber-100 text-amber-800" };
    }
    if (expense.otherValue && parseFloat(expense.otherValue) > 0) {
      return { label: "Outros", bgColor: "bg-indigo-100 text-indigo-800" };
    }
    return { label: "Despesa", bgColor: "bg-gray-100 text-gray-800" };
  };
  
  const exportExcel = async () => {
    if (!trip) return;
    
    try {
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      
      // Format data for Excel - com as colunas na ordem solicitada
      const data = expenses.map(expense => {
        // Usa os valores individuais para cada refeição
        const breakfastValue = expense.breakfastValue ? 
                              (expense.breakfastValue !== "" ? parseFloat(expense.breakfastValue || "0").toString() : "") 
                              : "";
        const lunchValue = expense.lunchValue ? 
                          (expense.lunchValue !== "" ? parseFloat(expense.lunchValue || "0").toString() : "") 
                          : "";
        const dinnerValue = expense.dinnerValue ? 
                           (expense.dinnerValue !== "" ? parseFloat(expense.dinnerValue || "0").toString() : "") 
                           : "";
        
        // Para km rodado, convertemos para valor em R$ (taxa de R$ 1,09 por km)
        const mileageKm = expense.mileage ? parseFloat(expense.mileage) : 0;
        const mileageValueRS = expense.mileageValue ? parseFloat(expense.mileageValue).toString() : "";
        
        return {
          "Data": expense.date ? format(new Date(expense.date), "dd/MM/yyyy") : "",
          "Destino": expense.destination || "",
          "Justificativa": expense.justification || "",
          "Café da manhã": breakfastValue, // Valor específico do café
          "Almoço": lunchValue, // Valor específico do almoço
          "Jantar": dinnerValue, // Valor específico do jantar
          "Taxi/uber": expense.transportValue ? parseFloat(expense.transportValue).toString() : "",
          "Estacio/pedagio": expense.parkingValue ? parseFloat(expense.parkingValue).toString() : "",
          "Km": mileageValueRS, // Valor em R$ do km rodado
          "Outros gastos": expense.otherValue ? parseFloat(expense.otherValue).toString() : "",
          "Descrição outros gastos": expense.otherDescription || "",
        };
      });
      
      // Calcular os totais reais de cada categoria
      const totalBreakfast = expenses.reduce((sum, exp) => sum + (exp.breakfastValue ? parseFloat(exp.breakfastValue || "0") : 0), 0);
      const totalLunch = expenses.reduce((sum, exp) => sum + (exp.lunchValue ? parseFloat(exp.lunchValue || "0") : 0), 0);
      const totalDinner = expenses.reduce((sum, exp) => sum + (exp.dinnerValue ? parseFloat(exp.dinnerValue || "0") : 0), 0);
      
      // Add summary row
      data.push({
        "Data": "",
        "Destino": "TOTAL",
        "Justificativa": "",
        "Café da manhã": totalBreakfast.toString(),
        "Almoço": totalLunch.toString(),
        "Jantar": totalDinner.toString(),
        "Taxi/uber": summary.transport.toString(),
        "Estacio/pedagio": summary.parking.toString(),
        "Km": summary.mileage.toString(), // Valor em R$ do total de km
        "Outros gastos": summary.other.toString(),
        "Descrição outros gastos": "",
      });
      
      // Create worksheet and add to workbook
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Despesas");
      
      // Generate Excel file
      const fileName = `Despesas_${trip.name.replace(/\s+/g, "_")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({
        title: "Exportação concluída",
        description: "O arquivo Excel foi gerado com sucesso",
      });
    } catch (error) {
      console.error("Error exporting Excel:", error);
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um erro ao gerar o arquivo Excel",
        variant: "destructive",
      });
    }
  };
  
  const exportPdf = async () => {
    if (!trip || expenses.length === 0) return;
    
    try {
      // Create PDF document
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      
      // Add header
      doc.setFontSize(18);
      doc.text(trip.name, margin, 20);
      
      // Add date range if available
      if (trip.startDate || trip.endDate) {
        doc.setFontSize(12);
        const dateRange = `Período: ${trip.startDate ? format(new Date(trip.startDate), "dd/MM/yyyy") : ""} ${trip.startDate && trip.endDate ? "a" : ""} ${trip.endDate ? format(new Date(trip.endDate), "dd/MM/yyyy") : ""}`;
        doc.text(dateRange, margin, 30);
      }
      
      // Add CPF if available
      if (trip.cpf) {
        doc.setFontSize(10);
        doc.text(`CPF: ${trip.cpf}`, margin, 40);
      }
      
      // Add summary box
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, 50, contentWidth, 40, "F");
      
      doc.setFontSize(12);
      doc.text("Resumo das Despesas", margin + 5, 60);
      
      doc.setFontSize(10);
      doc.text(`Refeições: ${formatCurrency(summary.meals)}`, margin + 5, 70);
      doc.text(`Transporte: ${formatCurrency(summary.transport)}`, margin + 70, 70);
      doc.text(`Estacionamento: ${formatCurrency(summary.parking)}`, margin + 5, 80);
      doc.text(`KM rodado: ${formatCurrency(summary.mileage)}`, margin + 70, 80);
      doc.text(`Outros: ${formatCurrency(summary.other)}`, margin + 140, 70);
      
      doc.setFontSize(12);
      doc.text(`Total: ${formatCurrency(summary.total)}`, pageWidth - margin - 40, 80, { align: "right" });
      
      // Add expenses list
      let y = 100;
      
      doc.setFontSize(14);
      doc.text("Lista de Despesas", margin, y);
      y += 10;
      
      // Loop through expenses
      for (let i = 0; i < expenses.length; i++) {
        const expense = expenses[i];
        
        // Check if we need a new page
        if (y > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage();
          y = 20;
        }
        
        // Add expense details
        doc.setFillColor(248, 249, 250);
        doc.rect(margin, y, contentWidth, 35, "F");
        
        const type = getExpenseTypeLabel(expense);
        
        doc.setFontSize(10);
        doc.text(format(new Date(expense.date), "dd/MM/yyyy"), margin + 5, y + 10);
        
        doc.setFontSize(12);
        doc.text(expense.destination, margin + 5, y + 20);
        
        doc.setFontSize(10);
        doc.text(expense.justification, margin + 5, y + 30, {
          maxWidth: contentWidth - 50,
        });
        
        doc.setFontSize(12);
        doc.text(formatCurrency(expense.totalValue), pageWidth - margin - 5, y + 20, { align: "right" });
        
        y += 45;
      }
      
      // Add page with receipt images
      doc.addPage();
      y = 20;
      
      doc.setFontSize(14);
      doc.text("Comprovantes", margin, y);
      y += 15;
      
      // Loop through expenses to add receipt images
      for (let i = 0; i < expenses.length; i++) {
        const expense = expenses[i];
        
        // Check if we need a new page
        if (y > doc.internal.pageSize.getHeight() - 100) {
          doc.addPage();
          y = 20;
        }
        
        // Add receipt date and description
        doc.setFontSize(10);
        doc.text(`${format(new Date(expense.date), "dd/MM/yyyy")} - ${expense.destination}`, margin, y);
        y += 10;
        
        // Add receipt image
        if (expense.receipt) {
          try {
            const imgHeight = 80;
            doc.addImage(expense.receipt, "JPEG", margin, y, contentWidth / 2, imgHeight);
            y += imgHeight + 20;
          } catch (error) {
            console.error("Error adding image to PDF:", error);
            y += 20;
          }
        }
      }
      
      // Save PDF
      const fileName = `Despesas_${trip.name.replace(/\s+/g, "_")}.pdf`;
      doc.save(fileName);
      
      toast({
        title: "Exportação concluída",
        description: "O arquivo PDF foi gerado com sucesso",
      });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um erro ao gerar o arquivo PDF",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={goBack} 
          className="text-primary hover:text-primary-dark mb-3 pl-0"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para viagens
        </Button>
        
        {isLoading ? (
          <div>
            <div className="h-8 bg-gray-200 rounded mb-2 w-3/4 animate-pulse"></div>
            <div className="h-5 bg-gray-200 rounded w-1/2 animate-pulse"></div>
          </div>
        ) : trip ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">{trip.name}</h2>
              <div className="flex items-center text-sm text-gray-500 mt-1">
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
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={exportPdf}
                disabled={expenses.length === 0}
              >
                <FileText className="h-4 w-4 text-red-500" /> PDF
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={exportExcel}
                disabled={expenses.length === 0}
              >
                <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel
              </Button>
              <Button className="gap-2" onClick={handleNewExpense}>
                <Plus className="h-4 w-4" /> Nova Despesa
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      
      {!isLoading && trip && (
        <Card className="bg-white rounded-xl shadow-sm mb-6">
          <CardContent className="p-4">
            <h3 className="font-medium text-gray-500 mb-3">Resumo das Despesas</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Refeições</p>
                <p className="font-mono font-medium text-lg">{formatCurrency(summary.meals)}</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Transporte</p>
                <p className="font-mono font-medium text-lg">{formatCurrency(summary.transport)}</p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">KM rodado</p>
                <p className="font-mono font-medium text-lg">{formatCurrency(summary.mileage)}</p>
              </div>
              <div className="text-center p-3 bg-indigo-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Outros</p>
                <p className="font-mono font-medium text-lg">{formatCurrency(summary.other)}</p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total de Despesas</span>
                <span className="font-mono font-semibold text-xl">{formatCurrency(summary.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <Card key={i} className="bg-white rounded-xl shadow-sm p-4 animate-pulse">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="h-6 bg-gray-200 rounded mb-3 w-1/2"></div>
                  <div className="h-5 bg-gray-200 rounded mb-2 w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-4 w-full"></div>
                  <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                </div>
                <div className="md:w-24 aspect-[3/4] bg-gray-200 rounded-lg"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : expenses.length > 0 ? (
        <div className="space-y-4">
          {expenses.map(expense => {
            const type = getExpenseTypeLabel(expense);
            return (
              <Card key={expense.id} className="bg-white rounded-xl shadow-sm">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center">
                          <span className={`text-sm ${type.bgColor} px-2 py-0.5 rounded-full`}>
                            {type.label}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            {format(new Date(expense.date), "dd/MM/yyyy")}
                          </span>
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-400 hover:text-gray-600 h-8 w-8"
                            onClick={(e) => handleEditExpense(expense, e)}
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-400 hover:text-rose-600 h-8 w-8"
                            onClick={(e) => handleDeleteExpense(expense, e)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                      
                      <h3 className="font-semibold">{expense.destination}</h3>
                      <p className="text-gray-600 text-sm mt-1 mb-3">{expense.justification}</p>
                      
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        {expense.mealValue && parseFloat(expense.mealValue) > 0 && (
                          <div>
                            <p className="text-xs text-gray-500">Refeição</p>
                            <p className="font-mono font-medium">{formatCurrency(expense.mealValue)}</p>
                          </div>
                        )}
                        
                        {expense.transportValue && parseFloat(expense.transportValue) > 0 && (
                          <div>
                            <p className="text-xs text-gray-500">Transporte</p>
                            <p className="font-mono font-medium">{formatCurrency(expense.transportValue)}</p>
                          </div>
                        )}
                        
                        {expense.parkingValue && parseFloat(expense.parkingValue) > 0 && (
                          <div>
                            <p className="text-xs text-gray-500">Estacionamento/Pedágio</p>
                            <p className="font-mono font-medium">{formatCurrency(expense.parkingValue)}</p>
                          </div>
                        )}
                        
                        {expense.mileage && expense.mileage > 0 && (
                          <div>
                            <p className="text-xs text-gray-500">KM rodados</p>
                            <p className="font-mono font-medium">{expense.mileage} km</p>
                          </div>
                        )}
                        
                        {expense.mileageValue && parseFloat(expense.mileageValue) > 0 && (
                          <div>
                            <p className="text-xs text-gray-500">Valor KM (R$ 1,09/km)</p>
                            <p className="font-mono font-medium">{formatCurrency(expense.mileageValue)}</p>
                          </div>
                        )}
                        
                        {expense.otherValue && parseFloat(expense.otherValue) > 0 && (
                          <div>
                            <p className="text-xs text-gray-500">
                              {expense.otherDescription ? `Outros: ${expense.otherDescription}` : "Outros"}
                            </p>
                            <p className="font-mono font-medium">{formatCurrency(expense.otherValue)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="md:w-24 flex-shrink-0">
                      <div 
                        className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition"
                        onClick={() => viewReceipt(expense)}
                      >
                        <img 
                          src={expense.receipt} 
                          alt="Comprovante" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <i className="ri-receipt-line text-primary text-2xl"></i>
          </div>
          <h3 className="text-xl font-medium mb-2">Nenhuma despesa registrada</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Adicione sua primeira despesa para começar a registrar gastos nesta viagem.
          </p>
          <Button onClick={handleNewExpense} className="gap-2 mx-auto">
            <Plus className="h-4 w-4" /> Adicionar Despesa
          </Button>
        </div>
      )}
      
      {showExpenseModal && tripId && (
        <ExpenseModal
          tripId={tripId}
          expense={selectedExpense}
          isOpen={showExpenseModal}
          onClose={() => {
            setShowExpenseModal(false);
            navigate(`/trip/${tripId}`, { replace: true });
          }}
          onSaved={loadTripAndExpenses}
        />
      )}
      
      <AlertDialog 
        open={!!expenseToDelete} 
        onOpenChange={(open) => !open && setExpenseToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente esta despesa
              {expenseToDelete?.destination && (
                <span className="font-semibold"> {expenseToDelete.destination}</span>
              )}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteExpense} 
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <ReceiptPreviewModal
        receiptUrl={receiptUrl}
        isOpen={showReceiptModal}
        onClose={() => {
          setShowReceiptModal(false);
          navigate(`/trip/${tripId}`, { replace: true });
        }}
      />
    </div>
  );
};

export default ExpenseList;
