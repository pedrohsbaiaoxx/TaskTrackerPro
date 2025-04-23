import { users, trips, expenses, type User, type InsertUser, type Trip, type InsertTrip, type Expense, type InsertExpense } from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import pg from "pg";
import session from "express-session";
import connectPg from "connect-pg-simple";

const { Pool } = pg;

// Conexão com o banco de dados Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

// Inicializa o Drizzle ORM com a conexão
const db = drizzle(pool);

// Store para as sessões
const PostgresSessionStore = connectPg(session);

// Interface para operações de armazenamento
export interface IStorage {
  // Usuários
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByCpf(cpf: string): Promise<User | undefined>;  // Adicionado método para buscar por CPF
  createUser(user: InsertUser): Promise<User>;

  // Viagens
  getTrip(id: number): Promise<Trip | undefined>;
  getTripsByUserId(userId: number): Promise<Trip[]>;
  getTripsByCpf(cpf: string): Promise<Trip[]>;
  createTrip(trip: InsertTrip): Promise<Trip>;
  updateTrip(id: number, trip: Partial<InsertTrip>): Promise<void>;
  deleteTrip(id: number): Promise<void>;

  // Despesas
  getExpense(id: number): Promise<Expense | undefined>;
  getExpensesByTripId(tripId: number): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: number, expense: Partial<InsertExpense>): Promise<void>;
  deleteExpense(id: number): Promise<void>;

  // Sessão
  sessionStore: session.Store;
}

// Implementação com PostgreSQL
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }

  // Métodos de usuário
  async getUser(id: number): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return results[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return results[0];
  }
  
  async getUserByCpf(cpf: string): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.cpf, cpf)).limit(1);
    return results[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const results = await db.insert(users).values(user).returning();
    return results[0];
  }

  // Métodos de viagem
  async getTrip(id: number): Promise<Trip | undefined> {
    const results = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
    return results[0];
  }

  async getTripsByUserId(userId: number): Promise<Trip[]> {
    return await db.select().from(trips).where(eq(trips.userId, userId));
  }

  async getTripsByCpf(cpf: string): Promise<Trip[]> {
    return await db.select().from(trips).where(eq(trips.cpf, cpf));
  }

  async createTrip(trip: InsertTrip): Promise<Trip> {
    // Garantir que os campos de data estejam no formato correto
    const processedTrip: any = { ...trip };
    
    // Garantir que a propriedade startDate seja uma instância Date válida
    if (processedTrip.startDate && !(processedTrip.startDate instanceof Date)) {
      try {
        processedTrip.startDate = new Date(processedTrip.startDate);
      } catch (e) {
        console.error("Erro convertendo startDate:", e);
        processedTrip.startDate = new Date();
      }
    }
    
    // Garantir que a propriedade endDate seja uma instância Date válida
    if (processedTrip.endDate && !(processedTrip.endDate instanceof Date)) {
      try {
        processedTrip.endDate = new Date(processedTrip.endDate);
      } catch (e) {
        console.error("Erro convertendo endDate:", e);
        delete processedTrip.endDate; // Remove se não pudermos converter
      }
    }
    
    // Garantir que os metadados são instâncias Date válidas
    if (processedTrip.createdAt && !(processedTrip.createdAt instanceof Date)) {
      try {
        processedTrip.createdAt = new Date(processedTrip.createdAt);
      } catch (e) {
        console.error("Erro convertendo createdAt:", e);
        processedTrip.createdAt = new Date();
      }
    }
    
    if (processedTrip.updatedAt && !(processedTrip.updatedAt instanceof Date)) {
      try {
        processedTrip.updatedAt = new Date(processedTrip.updatedAt);
      } catch (e) {
        console.error("Erro convertendo updatedAt:", e);
        processedTrip.updatedAt = new Date();
      }
    }
    
    // Verificar se precisamos adicionar metadados caso não tenham sido fornecidos
    if (!processedTrip.createdAt) {
      processedTrip.createdAt = new Date();
    }
    
    if (!processedTrip.updatedAt) {
      processedTrip.updatedAt = new Date();
    }
    
    console.log("Inserindo viagem no banco de dados:", {
      ...processedTrip,
      startDate: processedTrip.startDate ? processedTrip.startDate.toISOString() : null,
      endDate: processedTrip.endDate ? processedTrip.endDate.toISOString() : null,
      createdAt: processedTrip.createdAt ? processedTrip.createdAt.toISOString() : null,
      updatedAt: processedTrip.updatedAt ? processedTrip.updatedAt.toISOString() : null
    });
    
    const results = await db.insert(trips).values(processedTrip).returning();
    return results[0];
  }

  async updateTrip(id: number, tripData: Partial<InsertTrip>): Promise<void> {
    // Garantir que os campos de data estejam no formato correto
    const processedTrip: any = { ...tripData };
    
    // Garantir que a propriedade startDate seja uma instância Date válida
    if (processedTrip.startDate && !(processedTrip.startDate instanceof Date)) {
      try {
        processedTrip.startDate = new Date(processedTrip.startDate);
      } catch (e) {
        console.error("Erro convertendo startDate:", e);
        delete processedTrip.startDate; // Remove se não pudermos converter
      }
    }
    
    // Garantir que a propriedade endDate seja uma instância Date válida
    if (processedTrip.endDate && !(processedTrip.endDate instanceof Date)) {
      try {
        processedTrip.endDate = new Date(processedTrip.endDate);
      } catch (e) {
        console.error("Erro convertendo endDate:", e);
        delete processedTrip.endDate; // Remove se não pudermos converter
      }
    }
    
    // Adicionar updatedAt
    processedTrip.updatedAt = new Date();
    
    console.log("Atualizando viagem no banco de dados:", {
      ...processedTrip,
      startDate: processedTrip.startDate ? processedTrip.startDate.toISOString() : undefined,
      endDate: processedTrip.endDate ? processedTrip.endDate.toISOString() : undefined,
      updatedAt: processedTrip.updatedAt.toISOString()
    });
    
    await db.update(trips).set(processedTrip).where(eq(trips.id, id));
  }

  async deleteTrip(id: number): Promise<void> {
    await db.delete(trips).where(eq(trips.id, id));
  }

  // Métodos de despesa
  async getExpense(id: number): Promise<Expense | undefined> {
    const results = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    return results[0];
  }

  async getExpensesByTripId(tripId: number): Promise<Expense[]> {
    return await db.select().from(expenses).where(eq(expenses.tripId, tripId));
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    // Extraímos apenas os campos do InsertExpense que sabemos que são seguros
    // Isso evita campos não definidos que possam causar problemas
    const {
      tripId,
      date: rawDate,
      destination,
      justification,
      breakfastValue,
      lunchValue,
      dinnerValue,
      transportValue,
      parkingValue,
      mileage,
      mileageValue,
      otherValue,
      otherDescription,
      receipt,
      totalValue
    } = expense;
    
    // Convertemos a data explicitamente para um objeto Date
    let parsedDate: Date;
    try {
      if (rawDate instanceof Date) {
        parsedDate = rawDate;
      } else if (typeof rawDate === 'string') {
        parsedDate = new Date(rawDate);
        // Verificamos se a data é válida
        if (isNaN(parsedDate.getTime())) {
          console.error("Data inválida recebida:", rawDate);
          parsedDate = new Date();
        }
      } else {
        console.error("Tipo de data inválido recebido:", typeof rawDate);
        parsedDate = new Date();
      }
    } catch (e) {
      console.error("Erro ao converter data:", e);
      parsedDate = new Date();
    }
    
    // Agora criamos um objeto limpo com apenas os dados que queremos inserir
    // Adicionamos explicitamente os timestamps
    const now = new Date();
    
    const cleanExpense = {
      tripId,
      date: parsedDate,
      destination: destination || '',
      justification: justification || '',
      breakfastValue: breakfastValue || '0',
      lunchValue: lunchValue || '0',
      dinnerValue: dinnerValue || '0',
      transportValue: transportValue || '0',
      parkingValue: parkingValue || '0',
      mileage: mileage || 0,
      mileageValue: mileageValue || '0',
      otherValue: otherValue || '0',
      otherDescription: otherDescription || '',
      receipt: receipt || '',
      totalValue: totalValue || '0',
      createdAt: now,
      updatedAt: now
    };
    
    console.log("Inserindo despesa no banco de dados (processada):", {
      ...cleanExpense,
      date: cleanExpense.date.toISOString(),
      createdAt: cleanExpense.createdAt.toISOString(),
      updatedAt: cleanExpense.updatedAt.toISOString()
    });
    
    try {
      const results = await db.insert(expenses).values(cleanExpense).returning();
      return results[0];
    } catch (error) {
      console.error("Erro ao inserir despesa no banco de dados:", error);
      throw error;
    }
  }

  async updateExpense(id: number, expenseData: Partial<InsertExpense>): Promise<void> {
    // Criamos um objeto limpo para atualização
    const cleanUpdate: any = {};
    
    // Extraímos e processamos apenas os campos que foram fornecidos
    if (expenseData.tripId !== undefined) {
      cleanUpdate.tripId = expenseData.tripId;
    }
    
    // Processar a data se foi fornecida
    if (expenseData.date !== undefined) {
      try {
        if (expenseData.date instanceof Date) {
          cleanUpdate.date = expenseData.date;
        } else if (typeof expenseData.date === 'string') {
          const parsedDate = new Date(expenseData.date);
          if (!isNaN(parsedDate.getTime())) {
            cleanUpdate.date = parsedDate;
          } else {
            console.error("Data inválida na atualização:", expenseData.date);
          }
        }
      } catch (e) {
        console.error("Erro ao processar data na atualização:", e);
      }
    }
    
    // Processar campos de texto
    const textFields = [
      'destination', 'justification', 'breakfastValue', 'lunchValue', 
      'dinnerValue', 'transportValue', 'parkingValue', 'mileageValue',
      'otherValue', 'otherDescription', 'receipt', 'totalValue'
    ];
    
    textFields.forEach(field => {
      if (expenseData[field as keyof typeof expenseData] !== undefined) {
        cleanUpdate[field] = expenseData[field as keyof typeof expenseData] || '';
      }
    });
    
    // Processar campo numérico
    if (expenseData.mileage !== undefined) {
      cleanUpdate.mileage = expenseData.mileage || 0;
    }
    
    // Sempre adicionamos updatedAt
    cleanUpdate.updatedAt = new Date();
    
    console.log("Atualizando despesa no banco de dados (dados limpos):", {
      ...cleanUpdate,
      date: cleanUpdate.date ? cleanUpdate.date.toISOString() : undefined,
      updatedAt: cleanUpdate.updatedAt.toISOString()
    });
    
    try {
      await db.update(expenses).set(cleanUpdate).where(eq(expenses.id, id));
    } catch (error) {
      console.error("Erro ao atualizar despesa no banco de dados:", error);
      throw error;
    }
  }

  async deleteExpense(id: number): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }
}

// Exporta a implementação de armazenamento
export const storage = new DatabaseStorage();
