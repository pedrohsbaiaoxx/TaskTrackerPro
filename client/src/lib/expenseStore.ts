import { Trip, Expense } from "@shared/schema";
import { format } from "date-fns";

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
  const db = await getDB();
  const transaction = db.transaction([TRIPS_STORE], "readwrite");
  const store = transaction.objectStore(TRIPS_STORE);
  
  const newTrip: TripData = {
    ...trip,
    createdAt: new Date()
  };
  
  return new Promise((resolve, reject) => {
    const request = store.add(newTrip);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as number);
    transaction.oncomplete = () => db.close();
  });
}

export async function updateTrip(id: number, trip: Partial<TripData>): Promise<void> {
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
  const db = await getDB();
  const transaction = db.transaction([TRIPS_STORE], "readonly");
  const store = transaction.objectStore(TRIPS_STORE);
  const index = store.index("cpf");
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(cpf);
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
