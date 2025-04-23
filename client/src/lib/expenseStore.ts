import { Trip, Expense } from "@shared/schema";
import { format } from "date-fns";
import { apiRequest } from "./queryClient";

// Define the database name and store names
const DB_NAME = "ExpenseTrackerDB";
const DB_VERSION = 1;
const TRIPS_STORE = "trips";
const EXPENSES_STORE = "expenses";
const CPF_STORE = "cpf";

// Define the shape of our data
export interface TripData extends Omit<Trip, "id" | "userId"> {
  id?: number;
  createdAt: Date;
}

export interface ExpenseData extends Omit<Expense, "id" | "tripId"> {
  id?: number;
  tripId: number;
  createdAt: Date;
  // Campo legado para compatibilidade
  mealValue?: string;
}

// Initialize IndexedDB
export async function initializeDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("Error opening database:", (event.target as IDBRequest).error);
      reject((event.target as IDBRequest).error);
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create trips store
      if (!db.objectStoreNames.contains(TRIPS_STORE)) {
        const tripsStore = db.createObjectStore(TRIPS_STORE, { keyPath: "id", autoIncrement: true });
        tripsStore.createIndex("cpf", "cpf", { unique: false });
        tripsStore.createIndex("createdAt", "createdAt", { unique: false });
      }
      
      // Create expenses store
      if (!db.objectStoreNames.contains(EXPENSES_STORE)) {
        const expensesStore = db.createObjectStore(EXPENSES_STORE, { keyPath: "id", autoIncrement: true });
        expensesStore.createIndex("tripId", "tripId", { unique: false });
        expensesStore.createIndex("date", "date", { unique: false });
      }
      
      // Create CPF store for user identification
      if (!db.objectStoreNames.contains(CPF_STORE)) {
        db.createObjectStore(CPF_STORE, { keyPath: "id" });
      }
    };
  });
}

// Get a database connection
async function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => reject((event.target as IDBRequest).error);
    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
  });
}

// CPF functions
export async function saveCPF(cpf: string): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction([CPF_STORE], "readwrite");
  const store = transaction.objectStore(CPF_STORE);
  
  return new Promise((resolve, reject) => {
    const request = store.put({ id: "user", cpf });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    transaction.oncomplete = () => db.close();
  });
}

export async function getCPF(): Promise<string | null> {
  const db = await getDB();
  const transaction = db.transaction([CPF_STORE], "readonly");
  const store = transaction.objectStore(CPF_STORE);
  
  return new Promise((resolve, reject) => {
    const request = store.get("user");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.cpf : null);
    };
    transaction.oncomplete = () => db.close();
  });
}

// Trip functions
export async function saveTrip(trip: Omit<TripData, "id" | "createdAt">): Promise<number> {
  // Cria uma cópia local para o caso do servidor falhar
  const localTrip: TripData = {
    ...trip,
    createdAt: new Date()
  };
  
  try {
    // Prepara os dados para enviar para o servidor
    // Garante que as datas sejam objetos Date válidos
    const startDate = trip.startDate instanceof Date ? trip.startDate : 
                     (trip.startDate ? new Date(trip.startDate) : null);
    const endDate = trip.endDate instanceof Date ? trip.endDate : 
                   (trip.endDate ? new Date(trip.endDate) : null);
    
    const tripForServer = {
      ...trip,
      startDate,
      endDate
    };
    
    // Primeiro, tenta salvar no servidor
    try {
      // Usa fetch diretamente para ter mais controle sobre o erro
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(tripForServer)
      });
      
      if (response.ok) {
        const serverTrip = await response.json();
        console.log("Viagem salva no servidor com sucesso:", serverTrip);
        
        // Também salva localmente para disponibilidade offline
        try {
          const db = await getDB();
          const transaction = db.transaction([TRIPS_STORE], "readwrite");
          const store = transaction.objectStore(TRIPS_STORE);
          
          const newTrip: TripData = {
            ...trip,
            id: serverTrip.id, // Usa o ID do servidor
            createdAt: new Date(serverTrip.createdAt)
          };
          
          return new Promise((resolve, reject) => {
            const request = store.add(newTrip);
            request.onerror = (event) => {
              console.error("Erro ao salvar no IndexedDB:", event);
              resolve(serverTrip.id); // Mesmo com erro no IndexedDB, retorna o ID do servidor
            };
            request.onsuccess = () => {
              console.log("Viagem sincronizada com IndexedDB");
              resolve(serverTrip.id);
            };
            transaction.oncomplete = () => db.close();
          });
        } catch (dbError) {
          console.error("Erro ao abrir IndexedDB:", dbError);
          return serverTrip.id; // Retorna o ID do servidor mesmo com erro no IndexedDB
        }
      } else {
        const errorText = await response.text();
        throw new Error(`Erro ao salvar viagem no servidor: ${response.status} - ${errorText}`);
      }
    } catch (networkError) {
      console.error("Erro de rede ao salvar no servidor:", networkError);
      throw networkError;
    }
  } catch (error) {
    console.warn("Erro ao salvar viagem no servidor, salvando apenas localmente:", error);
    
    // Fallback para salvar apenas localmente se o servidor falhar
    try {
      const db = await getDB();
      const transaction = db.transaction([TRIPS_STORE], "readwrite");
      const store = transaction.objectStore(TRIPS_STORE);
      
      return new Promise((resolve, reject) => {
        const request = store.add(localTrip);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result as number);
        transaction.oncomplete = () => db.close();
      });
    } catch (dbError) {
      console.error("Erro crítico: Falha ao salvar tanto no servidor quanto localmente:", dbError);
      throw dbError;
    }
  }
}

export async function updateTrip(id: number, trip: Partial<TripData>): Promise<void> {
  try {
    // Prepara os dados para enviar para o servidor
    // Garante que as datas sejam objetos Date válidos
    const startDate = trip.startDate instanceof Date ? trip.startDate : 
                     (trip.startDate ? new Date(trip.startDate) : null);
    const endDate = trip.endDate instanceof Date ? trip.endDate : 
                   (trip.endDate ? new Date(trip.endDate) : null);
    
    const tripForServer = {
      ...trip,
      startDate,
      endDate
    };
    
    // Primeiro, tenta atualizar no servidor
    const response = await apiRequest("PUT", `/api/trips/${id}`, tripForServer);
    
    if (response.ok) {
      // Se a atualização no servidor for bem-sucedida, atualiza localmente
      const db = await getDB();
      const transaction = db.transaction([TRIPS_STORE], "readwrite");
      const store = transaction.objectStore(TRIPS_STORE);
      
      return new Promise((resolve, reject) => {
        const request = store.get(id);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const existingTrip = request.result;
          if (!existingTrip) {
            // Se não existir localmente, busca a versão atualizada do servidor
            resolve();
            return;
          }
          
          const updatedTrip = { ...existingTrip, ...trip };
          const updateRequest = store.put(updatedTrip);
          
          updateRequest.onerror = () => reject(updateRequest.error);
          updateRequest.onsuccess = () => resolve();
        };
        
        transaction.oncomplete = () => db.close();
      });
    }
  } catch (error) {
    console.warn("Erro ao atualizar viagem no servidor, atualizando apenas localmente:", error);
  }
  
  // Fallback para atualizar apenas localmente se o servidor falhar
  const db = await getDB();
  const transaction = db.transaction([TRIPS_STORE], "readwrite");
  const store = transaction.objectStore(TRIPS_STORE);
  
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const existingTrip = request.result;
      if (!existingTrip) {
        reject(new Error("Trip not found"));
        return;
      }
      
      const updatedTrip = { ...existingTrip, ...trip };
      const updateRequest = store.put(updatedTrip);
      
      updateRequest.onerror = () => reject(updateRequest.error);
      updateRequest.onsuccess = () => resolve();
    };
    
    transaction.oncomplete = () => db.close();
  });
}

export async function deleteTrip(id: number): Promise<void> {
  try {
    // Primeiro, tenta deletar no servidor
    const response = await apiRequest("DELETE", `/api/trips/${id}`);
    
    if (response.ok) {
      // Se a deleção no servidor for bem-sucedida, deleta localmente
      await deleteLocalTrip(id);
      return;
    }
  } catch (error) {
    console.warn("Erro ao deletar viagem no servidor, deletando apenas localmente:", error);
  }
  
  // Fallback para deletar apenas localmente se o servidor falhar
  await deleteLocalTrip(id);
}

// Função auxiliar para deletar viagem localmente
async function deleteLocalTrip(id: number): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction([TRIPS_STORE, EXPENSES_STORE], "readwrite");
  const tripsStore = transaction.objectStore(TRIPS_STORE);
  const expensesStore = transaction.objectStore(EXPENSES_STORE);
  const expensesIndex = expensesStore.index("tripId");
  
  return new Promise((resolve, reject) => {
    // First delete all expenses for this trip
    const cursorRequest = expensesIndex.openCursor(IDBKeyRange.only(id));
    
    cursorRequest.onerror = () => reject(cursorRequest.error);
    cursorRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        expensesStore.delete(cursor.primaryKey);
        cursor.continue();
      } else {
        // Now delete the trip
        const deleteRequest = tripsStore.delete(id);
        deleteRequest.onerror = () => reject(deleteRequest.error);
        deleteRequest.onsuccess = () => resolve();
      }
    };
    
    transaction.oncomplete = () => db.close();
  });
}

export async function getTrip(id: number): Promise<TripData | null> {
  const db = await getDB();
  const transaction = db.transaction([TRIPS_STORE], "readonly");
  const store = transaction.objectStore(TRIPS_STORE);
  
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
    transaction.oncomplete = () => db.close();
  });
}

export async function getAllTrips(): Promise<TripData[]> {
  const db = await getDB();
  const transaction = db.transaction([TRIPS_STORE], "readonly");
  const store = transaction.objectStore(TRIPS_STORE);
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Sort by created date, most recent first
      const trips = request.result as TripData[];
      trips.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      resolve(trips);
    };
    transaction.oncomplete = () => db.close();
  });
}

export async function getTripsByCpf(cpf: string): Promise<TripData[]> {
  let serverTrips: TripData[] = [];
  let gotServerData = false;
  
  try {
    // Primeiro tenta buscar as viagens do servidor
    console.log(`Buscando viagens para o CPF: ${cpf}`);
    const response = await fetch(`/api/trips/by-cpf/${cpf}`, {
      credentials: 'include',
    });
    
    // Se a API retornar com sucesso, usa os dados do servidor
    if (response.ok) {
      const trips = await response.json();
      console.log(`Encontradas ${trips.length} viagens no servidor`);
      
      // Converte as datas de string para objetos Date
      serverTrips = trips.map((trip: any) => ({
        ...trip,
        createdAt: new Date(trip.createdAt),
        startDate: trip.startDate ? new Date(trip.startDate) : null,
        endDate: trip.endDate ? new Date(trip.endDate) : null,
      }));
      
      gotServerData = true;
      
      // Sincroniza as viagens do servidor com o IndexedDB
      try {
        const db = await getDB();
        const transaction = db.transaction([TRIPS_STORE], "readwrite");
        const store = transaction.objectStore(TRIPS_STORE);
        
        console.log("Sincronizando viagens do servidor com o IndexedDB");
        
        // Para cada viagem do servidor, salva ou atualiza no IndexedDB
        const syncPromises = serverTrips.map(trip => {
          return new Promise<void>((resolve) => {
            if (!trip.id) {
              resolve();
              return;
            }
            
            const getRequest = store.get(trip.id);
            getRequest.onsuccess = () => {
              if (getRequest.result) {
                // Atualiza a viagem existente
                store.put(trip);
              } else {
                // Adiciona a nova viagem
                store.add(trip);
              }
              resolve();
            };
            getRequest.onerror = () => resolve(); // Continua mesmo com erro
          });
        });
        
        // Espera todas as operações terminarem
        await Promise.all(syncPromises);
        transaction.oncomplete = () => db.close();
        
        return serverTrips;
      } catch (syncError) {
        console.error("Erro ao sincronizar com IndexedDB:", syncError);
        return serverTrips;
      }
    } else {
      console.warn(`Erro ao buscar viagens: ${response.status} - ${response.statusText}`);
    }
  } catch (error) {
    console.warn("Erro ao buscar viagens da API, usando dados locais:", error);
  }
  
  // Se não conseguimos dados do servidor, busca os dados locais do IndexedDB
  try {
    const db = await getDB();
    const transaction = db.transaction([TRIPS_STORE], "readonly");
    const store = transaction.objectStore(TRIPS_STORE);
    const index = store.index("cpf");
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(cpf);
      request.onerror = () => {
        console.error("Erro ao buscar viagens do IndexedDB:", request.error);
        reject(request.error);
      };
      request.onsuccess = () => {
        console.log(`Encontradas ${request.result.length} viagens no IndexedDB`);
        // Ordena por data de criação, mais recente primeiro
        const localTrips = request.result as TripData[];
        localTrips.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        resolve(localTrips);
      };
      transaction.oncomplete = () => db.close();
    });
  } catch (dbError) {
    console.error("Erro ao abrir IndexedDB:", dbError);
    return []; // Retorna array vazio se tudo falhar
  }
}

// Expense functions
export async function saveExpense(expense: Omit<ExpenseData, "id" | "createdAt">): Promise<number> {
  const db = await getDB();
  const transaction = db.transaction([EXPENSES_STORE], "readwrite");
  const store = transaction.objectStore(EXPENSES_STORE);
  
  const newExpense: ExpenseData = {
    ...expense,
    createdAt: new Date()
  };
  
  return new Promise((resolve, reject) => {
    const request = store.add(newExpense);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as number);
    transaction.oncomplete = () => db.close();
  });
}

export async function updateExpense(id: number, expense: Partial<ExpenseData>): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction([EXPENSES_STORE], "readwrite");
  const store = transaction.objectStore(EXPENSES_STORE);
  
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const existingExpense = request.result;
      if (!existingExpense) {
        reject(new Error("Expense not found"));
        return;
      }
      
      const updatedExpense = { ...existingExpense, ...expense };
      const updateRequest = store.put(updatedExpense);
      
      updateRequest.onerror = () => reject(updateRequest.error);
      updateRequest.onsuccess = () => resolve();
    };
    
    transaction.oncomplete = () => db.close();
  });
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction([EXPENSES_STORE], "readwrite");
  const store = transaction.objectStore(EXPENSES_STORE);
  
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    transaction.oncomplete = () => db.close();
  });
}

export async function getExpense(id: number): Promise<ExpenseData | null> {
  const db = await getDB();
  const transaction = db.transaction([EXPENSES_STORE], "readonly");
  const store = transaction.objectStore(EXPENSES_STORE);
  
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
    transaction.oncomplete = () => db.close();
  });
}

export async function getExpensesByTrip(tripId: number): Promise<ExpenseData[]> {
  const db = await getDB();
  const transaction = db.transaction([EXPENSES_STORE], "readonly");
  const store = transaction.objectStore(EXPENSES_STORE);
  const index = store.index("tripId");
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(tripId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Sort by date, most recent first
      const expenses = request.result as ExpenseData[];
      expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(expenses);
    };
    transaction.oncomplete = () => db.close();
  });
}

// Helper function to format currency
export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return 'R$ 0,00';
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(numValue);
}

// Helper to format date ranges for trips
export function formatDateRange(startDate: Date | null, endDate: Date | null): string {
  if (!startDate && !endDate) {
    return "";
  }
  
  if (startDate && !endDate) {
    return format(startDate, 'dd/MM/yyyy');
  }
  
  if (!startDate && endDate) {
    return `até ${format(endDate, 'dd/MM/yyyy')}`;
  }
  
  return `${format(startDate!, 'dd/MM/yyyy')} - ${format(endDate!, 'dd/MM/yyyy')}`;
}

// Calculate expense totals for a trip
export interface ExpenseSummary {
  meals: number;
  transport: number;
  parking: number;
  mileage: number;
  other: number;
  total: number;
}

export async function calculateTripSummary(tripId: number): Promise<ExpenseSummary> {
  const expenses = await getExpensesByTrip(tripId);
  
  const summary: ExpenseSummary = {
    meals: 0,
    transport: 0,
    parking: 0,
    mileage: 0,
    other: 0,
    total: 0
  };
  
  expenses.forEach(expense => {
    summary.meals += expense.mealValue ? parseFloat(expense.mealValue) : 0;
    summary.transport += expense.transportValue ? parseFloat(expense.transportValue) : 0;
    summary.parking += expense.parkingValue ? parseFloat(expense.parkingValue) : 0;
    summary.mileage += expense.mileageValue ? parseFloat(expense.mileageValue) : 0;
    summary.other += expense.otherValue ? parseFloat(expense.otherValue) : 0;
    summary.total += expense.totalValue ? parseFloat(expense.totalValue) : 0;
  });
  
  return summary;
}

// Export functions for Excel and PDF generation
export async function generateExcelData(tripId: number): Promise<any> {
  const trip = await getTrip(tripId);
  const expenses = await getExpensesByTrip(tripId);
  
  return {
    trip,
    expenses
  };
}

export async function generatePdfData(tripId: number): Promise<any> {
  const trip = await getTrip(tripId);
  const expenses = await getExpensesByTrip(tripId);
  const summary = await calculateTripSummary(tripId);
  
  return {
    trip,
    expenses,
    summary
  };
}
