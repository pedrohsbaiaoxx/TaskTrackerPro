import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, Timestamp } from "firebase/firestore";
import { TripData, ExpenseData } from "./expenseStore";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Collections
const TRIPS_COLLECTION = "trips";
const EXPENSES_COLLECTION = "expenses";
const USERS_COLLECTION = "users";

// Interface para tipos Firebase
interface FirebaseUser {
  id: string;
  cpf: string;
  createdAt: Timestamp;
}

interface FirebaseTrip {
  id: string;
  cpf: string;
  name: string;
  description?: string;
  startDate: Timestamp;
  endDate?: Timestamp;
  createdAt: Timestamp;
}

interface FirebaseExpense {
  id: string;
  tripId: string;
  type: string;
  amount: number;
  date: Timestamp;
  description?: string;
  destination?: string;
  receiptUrl?: string;
  createdAt: Timestamp;
  category?: string;
  paymentMethod?: string;
  isReimbursable?: boolean;
  status?: string;
  vendor?: string;
  notes?: string;
}

// Funções para converter entre formatos de data
function convertFirebaseTimestampToDate(timestamp: Timestamp): Date {
  return timestamp.toDate();
}

function convertDateToFirebaseTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

// Funções para gerenciar usuários
export async function createUser(cpf: string) {
  try {
    // Verifica se já existe um usuário com este CPF
    const existingUser = await getUserByCpf(cpf);
    
    if (existingUser) {
      return existingUser;
    }
    
    // Cria o novo usuário
    const userData = {
      cpf,
      createdAt: Timestamp.now()
    };
    
    const userRef = await addDoc(collection(db, USERS_COLLECTION), userData);
    
    return {
      id: userRef.id,
      cpf
    };
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    throw new Error("Não foi possível criar o usuário");
  }
}

export async function getUserByCpf(cpf: string) {
  try {
    const q = query(collection(db, USERS_COLLECTION), where("cpf", "==", cpf));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    
    return {
      id: userDoc.id,
      cpf: userData.cpf as string
    };
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);
    throw new Error("Não foi possível buscar o usuário");
  }
}

// Funções para gerenciar viagens
export async function saveTrip(trip: Omit<TripData, "id" | "createdAt">) {
  try {
    const newTrip = {
      ...trip,
      startDate: trip.startDate ? convertDateToFirebaseTimestamp(trip.startDate) : null,
      endDate: trip.endDate ? convertDateToFirebaseTimestamp(trip.endDate) : null,
      createdAt: Timestamp.now()
    };
    
    const tripRef = await addDoc(collection(db, TRIPS_COLLECTION), newTrip);
    return tripRef.id;
  } catch (error) {
    console.error("Erro ao salvar viagem:", error);
    throw new Error("Não foi possível salvar a viagem");
  }
}

export async function updateTrip(id: string, tripData: Partial<TripData>) {
  try {
    const trip = { ...tripData };
    
    // Converter datas para Timestamp do Firestore
    if (trip.startDate) {
      trip.startDate = convertDateToFirebaseTimestamp(trip.startDate);
    }
    
    if (trip.endDate) {
      trip.endDate = convertDateToFirebaseTimestamp(trip.endDate);
    }
    
    const tripRef = doc(db, TRIPS_COLLECTION, id);
    await updateDoc(tripRef, trip as any);
  } catch (error) {
    console.error("Erro ao atualizar viagem:", error);
    throw new Error("Não foi possível atualizar a viagem");
  }
}

export async function deleteTrip(id: string) {
  try {
    const tripRef = doc(db, TRIPS_COLLECTION, id);
    await deleteDoc(tripRef);
    
    // Também excluir todas as despesas associadas a esta viagem
    const expenses = await getExpensesByTrip(id);
    for (const expense of expenses) {
      if (expense.id) {
        await deleteExpense(expense.id.toString());
      }
    }
  } catch (error) {
    console.error("Erro ao excluir viagem:", error);
    throw new Error("Não foi possível excluir a viagem");
  }
}

export async function getTrip(id: string) {
  try {
    const tripRef = doc(db, TRIPS_COLLECTION, id);
    const tripSnap = await getDoc(tripRef);
    
    if (!tripSnap.exists()) {
      return null;
    }
    
    const tripData = tripSnap.data();
    
    // Converter Timestamp para Date
    return {
      id: tripSnap.id,
      cpf: tripData.cpf,
      name: tripData.name,
      description: tripData.description,
      startDate: tripData.startDate ? convertFirebaseTimestampToDate(tripData.startDate) : null,
      endDate: tripData.endDate ? convertFirebaseTimestampToDate(tripData.endDate) : null,
      createdAt: convertFirebaseTimestampToDate(tripData.createdAt)
    } as TripData;
  } catch (error) {
    console.error("Erro ao buscar viagem:", error);
    throw new Error("Não foi possível buscar a viagem");
  }
}

export async function getTripsByCpf(cpf: string) {
  try {
    const q = query(collection(db, TRIPS_COLLECTION), where("cpf", "==", cpf));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        cpf: data.cpf,
        name: data.name,
        description: data.description,
        startDate: data.startDate ? convertFirebaseTimestampToDate(data.startDate) : null,
        endDate: data.endDate ? convertFirebaseTimestampToDate(data.endDate) : null,
        createdAt: convertFirebaseTimestampToDate(data.createdAt)
      } as TripData;
    });
  } catch (error) {
    console.error("Erro ao buscar viagens:", error);
    throw new Error("Não foi possível buscar as viagens");
  }
}

// Funções para gerenciar despesas
export async function saveExpense(expense: Omit<ExpenseData, "id" | "createdAt">) {
  try {
    const newExpense = {
      ...expense,
      tripId: expense.tripId.toString(), // Converter para string
      date: expense.date ? convertDateToFirebaseTimestamp(expense.date) : null,
      createdAt: Timestamp.now()
    };
    
    const expenseRef = await addDoc(collection(db, EXPENSES_COLLECTION), newExpense);
    return expenseRef.id;
  } catch (error) {
    console.error("Erro ao salvar despesa:", error);
    throw new Error("Não foi possível salvar a despesa");
  }
}

export async function updateExpense(id: string, expenseData: Partial<ExpenseData>) {
  try {
    const expense = { ...expenseData };
    
    // Converter datas para Timestamp do Firestore
    if (expense.date) {
      expense.date = convertDateToFirebaseTimestamp(expense.date);
    }
    
    if (expense.tripId) {
      expense.tripId = expense.tripId.toString(); // Converter para string
    }
    
    const expenseRef = doc(db, EXPENSES_COLLECTION, id);
    await updateDoc(expenseRef, expense as any);
  } catch (error) {
    console.error("Erro ao atualizar despesa:", error);
    throw new Error("Não foi possível atualizar a despesa");
  }
}

export async function deleteExpense(id: string) {
  try {
    const expenseRef = doc(db, EXPENSES_COLLECTION, id);
    await deleteDoc(expenseRef);
  } catch (error) {
    console.error("Erro ao excluir despesa:", error);
    throw new Error("Não foi possível excluir a despesa");
  }
}

export async function getExpense(id: string) {
  try {
    const expenseRef = doc(db, EXPENSES_COLLECTION, id);
    const expenseSnap = await getDoc(expenseRef);
    
    if (!expenseSnap.exists()) {
      return null;
    }
    
    const expenseData = expenseSnap.data();
    
    // Converter Timestamp para Date e ID de string para number
    return {
      id: expenseSnap.id,
      tripId: parseInt(expenseData.tripId), // Converter para número
      type: expenseData.type,
      amount: expenseData.amount,
      date: expenseData.date ? convertFirebaseTimestampToDate(expenseData.date) : null,
      description: expenseData.description,
      destination: expenseData.destination,
      receiptUrl: expenseData.receiptUrl,
      createdAt: convertFirebaseTimestampToDate(expenseData.createdAt),
      category: expenseData.category,
      paymentMethod: expenseData.paymentMethod,
      isReimbursable: expenseData.isReimbursable,
      status: expenseData.status,
      vendor: expenseData.vendor,
      notes: expenseData.notes
    } as ExpenseData;
  } catch (error) {
    console.error("Erro ao buscar despesa:", error);
    throw new Error("Não foi possível buscar a despesa");
  }
}

export async function getExpensesByTrip(tripId: string) {
  try {
    const q = query(collection(db, EXPENSES_COLLECTION), where("tripId", "==", tripId));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        tripId: parseInt(data.tripId), // Converter para número
        type: data.type,
        amount: data.amount,
        date: data.date ? convertFirebaseTimestampToDate(data.date) : null,
        description: data.description,
        destination: data.destination,
        receiptUrl: data.receiptUrl,
        createdAt: convertFirebaseTimestampToDate(data.createdAt),
        category: data.category,
        paymentMethod: data.paymentMethod,
        isReimbursable: data.isReimbursable,
        status: data.status,
        vendor: data.vendor,
        notes: data.notes
      } as ExpenseData;
    });
  } catch (error) {
    console.error("Erro ao buscar despesas:", error);
    throw new Error("Não foi possível buscar as despesas");
  }
}