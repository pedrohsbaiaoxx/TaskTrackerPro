import { TripData, ExpenseData, getTripsByCpf, deleteAndRecreateDB, getExpensesByTrip, deleteExpense } from "./expenseStore";
import { apiRequest } from "./queryClient";

// Define constantes usadas pelo banco de dados
const DB_NAME = "ExpenseTrackerDB";
const DB_VERSION = 2;
const TRIPS_STORE = "trips";
const EXPENSES_STORE = "expenses";
const CPF_STORE = "cpf";

// Função para sincronizar dados do servidor
export async function syncTripsFromServer(cpf: string): Promise<boolean> {
  try {
    console.log(`Sincronizando viagens para o CPF: ${cpf}`);
    const response = await fetch(`/api/trips/by-cpf/${cpf}`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      console.warn(`Erro ao buscar viagens: ${response.status} - ${response.statusText}`);
      return false;
    }
    
    const trips = await response.json();
    console.log(`Encontradas ${trips.length} viagens no servidor para sincronização`);
    
    // Converte as datas de string para objetos Date
    const serverTrips = trips.map((trip: any) => ({
      ...trip,
      createdAt: trip.createdAt ? new Date(trip.createdAt) : new Date(),
      startDate: trip.startDate ? new Date(trip.startDate) : null,
      endDate: trip.endDate ? new Date(trip.endDate) : null,
    }));
    
    // Sincroniza as viagens do servidor com o IndexedDB
    const db = await getDB();
    const transaction = db.transaction(["trips"], "readwrite");
    const store = transaction.objectStore("trips");
    
    console.log(`Sincronizando ${serverTrips.length} viagens do servidor com o IndexedDB`);
    
    // Limpa qualquer viagem existente com esse CPF para evitar duplicatas
    const index = store.index("cpf");
    const oldTripsRequest = index.getAll(cpf);
    
    await new Promise<void>((resolve) => {
      oldTripsRequest.onsuccess = async () => {
        const oldTrips = oldTripsRequest.result || [];
        console.log(`Verificando ${oldTrips.length} viagens existentes no IndexedDB`);
        
        // Para cada viagem do servidor, adiciona ou atualiza no IndexedDB
        for (const trip of serverTrips) {
          if (!trip.id) continue;
          
          try {
            // Verifica se já existe uma viagem com esse ID
            const getRequest = store.get(trip.id);
            await new Promise<void>((resolveGet) => {
              getRequest.onsuccess = () => {
                if (getRequest.result) {
                  console.log(`Atualizando viagem ${trip.id} no IndexedDB`);
                  store.put(trip);
                } else {
                  console.log(`Adicionando nova viagem ${trip.id} ao IndexedDB`);
                  store.add(trip);
                }
                resolveGet();
              };
              getRequest.onerror = () => resolveGet();
            });
          } catch (err) {
            console.warn(`Erro ao sincronizar viagem ${trip.id}:`, err);
          }
        }
        
        resolve();
      };
      oldTripsRequest.onerror = () => resolve();
    });
    
    return new Promise<boolean>((resolve) => {
      transaction.oncomplete = () => {
        db.close();
        console.log("Sincronização com servidor concluída com sucesso");
        
        // Dispara evento para avisar a interface sobre a atualização
        window.dispatchEvent(new CustomEvent('tripsUpdated'));
        
        resolve(true);
      };
      transaction.onerror = () => {
        db.close();
        console.error("Erro na transação de sincronização:", transaction.error);
        resolve(false);
      };
    });
  } catch (error) {
    console.error("Erro na sincronização:", error);
    return false;
  }
}

// Limpa completamente o IndexedDB local para permitir sincronização total
export async function clearLocalDatabase(): Promise<boolean> {
  try {
    console.log("Iniciando limpeza completa do banco de dados local");
    
    // Usa a função importada de expenseStore.ts para limpeza e recriação
    const success = await deleteAndRecreateDB();
    
    if (success) {
      console.log("Banco de dados limpo e recriado com sucesso");
      return true;
    }
    
    // Fallback: Implementação manual se a função importada falhar
    console.log("Fallback: tentando método alternativo de limpeza do banco");
    
    return new Promise<boolean>((resolve) => {
      // Fecha todas as conexões e deleta o banco de dados
      const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
      
      deleteRequest.onsuccess = () => {
        console.log("Banco de dados local deletado com sucesso");
        
        // Criar banco novamente com versão atualizada
        const createRequest = indexedDB.open(DB_NAME, DB_VERSION);
        
        createRequest.onupgradeneeded = (event) => {
          try {
            const db = (event.target as IDBOpenDBRequest).result;
            
            // Criar todas as stores necessárias
            const tripsStore = db.createObjectStore(TRIPS_STORE, { keyPath: "id", autoIncrement: true });
            tripsStore.createIndex("cpf", "cpf", { unique: false });
            tripsStore.createIndex("createdAt", "createdAt", { unique: false });
            
            const expensesStore = db.createObjectStore(EXPENSES_STORE, { keyPath: "id", autoIncrement: true });
            expensesStore.createIndex("tripId", "tripId", { unique: false });
            expensesStore.createIndex("date", "date", { unique: false });
            
            db.createObjectStore(CPF_STORE, { keyPath: "id" });
            
            console.log("Estrutura do banco recriada com sucesso");
          } catch (e) {
            console.error("Erro ao recriar estrutura do banco:", e);
          }
        };
        
        createRequest.onsuccess = () => {
          console.log("Banco de dados recriado com sucesso");
          createRequest.result.close();
          resolve(true);
        };
        
        createRequest.onerror = () => {
          console.error("Erro ao recriar banco de dados:", createRequest.error);
          resolve(false);
        };
      };
      
      deleteRequest.onerror = () => {
        console.error("Erro ao deletar banco de dados:", deleteRequest.error);
        resolve(false);
      };
    });
  } catch (error) {
    console.error("Erro crítico ao limpar banco de dados:", error);
    return false;
  }
}

// Obtem conexão com o banco de dados
async function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ExpenseTrackerDB", 1);
    request.onerror = (event) => reject((event.target as IDBRequest).error);
    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
  });
}

// Função para sincronizar despesas do IndexedDB para o servidor
export async function syncExpenseToServer(expense: ExpenseData): Promise<boolean> {
  try {
    console.log(`Enviando despesa para o servidor. TripId: ${expense.tripId}`);
    
    // Processamos as datas para garantir compatibilidade e remover campos problemáticos
    const { id, createdAt, updatedAt, ...restExpense } = expense;
    
    // Converter a data para string ISO - precisamos ter certeza de que é uma data válida
    const dateObj = expense.date instanceof Date ? expense.date : new Date(expense.date);
    const dateString = dateObj.toISOString();
    
    // Garantir que valores numéricos sejam realmente números e não strings
    const cleanedExpense: any = {};
    
    // Processar valores numéricos
    Object.entries(restExpense).forEach(([key, value]) => {
      if (key === 'mileage') {
        cleanedExpense[key] = typeof value === 'string' ? parseInt(value) : value;
      } 
      else if (key.includes('Value') && key !== 'totalValue' && key !== 'mileageValue') {
        // Valores monetários (exceto totalValue e mileageValue que já estão no formato correto)
        cleanedExpense[key] = value === null || value === '' ? '0' : value;
      } 
      else {
        cleanedExpense[key] = value;
      }
    });
    
    // Criamos um objeto limpo para enviar ao servidor
    const processedExpense = {
      ...cleanedExpense,
      date: dateString,
      // Todos os campos totalValue, receipt devem existir
      totalValue: cleanedExpense.totalValue || '0',
      receipt: cleanedExpense.receipt || ''
    };
    
    console.log("Enviando despesa processada:", processedExpense);
    
    // Enviamos para o servidor usando apiRequest
    const response = await apiRequest(
      "POST", 
      `/api/trips/${expense.tripId}/expenses`, 
      processedExpense
    );
    
    if (!response.ok) {
      console.error(`Erro ao enviar despesa para o servidor: ${response.status}`);
      return false;
    }
    
    const savedExpense = await response.json();
    console.log("Despesa salva no servidor com sucesso:", savedExpense);
    return true;
  } catch (error) {
    console.error("Erro ao sincronizar despesa com servidor:", error);
    return false;
  }
}

// Função para excluir despesa do servidor
export async function deleteExpenseFromServer(expenseId: number): Promise<boolean> {
  try {
    console.log(`Excluindo despesa do servidor. ID: ${expenseId}`);
    
    // Enviamos para o servidor usando apiRequest
    const response = await apiRequest(
      "DELETE", 
      `/api/expenses/${expenseId}`, 
      undefined
    );
    
    if (!response.ok) {
      console.error(`Erro ao excluir despesa do servidor: ${response.status}`);
      return false;
    }
    
    console.log(`Despesa ${expenseId} excluída do servidor com sucesso`);
    return true;
  } catch (error) {
    console.error("Erro ao excluir despesa do servidor:", error);
    return false;
  }
}

export async function verifyAndFixDatabase(cpf: string): Promise<boolean> {
  try {
    console.log("Iniciando verificação do banco de dados...");
    
    // Primeiro, verifica quantas viagens temos localmente
    const localTrips = await getTripsByCpf(cpf);
    console.log(`Verificação: ${localTrips.length} viagens encontradas localmente`);
    
    // Agora verifica quantas viagens o servidor tem
    const response = await fetch(`/api/trips/by-cpf/${cpf}`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      console.error(`Erro ao buscar viagens do servidor: ${response.status}`);
      return false;
    }
    
    const serverTrips = await response.json();
    console.log(`Verificação: ${serverTrips.length} viagens encontradas no servidor`);
    
    // Compara os dados de ambas as fontes
    const localIds = new Set(localTrips.map((t: any) => t.id));
    const serverIds = new Set(serverTrips.map((t: any) => t.id));
    
    // Verifica se existem viagens no servidor que não estão no local
    const missingLocally = Array.from(serverIds).filter((id: any) => !localIds.has(id));
    
    if (missingLocally.length > 0) {
      console.log(`Detectadas ${missingLocally.length} viagens faltando localmente`);
      
      // Limpa o banco de dados local e sincroniza novamente
      console.log("Iniciando limpeza e ressincronização...");
      await clearLocalDatabase();
      await syncTripsFromServer(cpf);
      return true;
    }
    
    // Tudo parece ok
    console.log("Verificação concluída: banco de dados parece consistente");
    return true;
  } catch (error) {
    console.error("Erro ao verificar e reparar banco de dados:", error);
    return false;
  }
}