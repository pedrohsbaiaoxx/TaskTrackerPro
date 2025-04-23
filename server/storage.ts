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
    // Garantir que os campos de data estejam no formato correto
    const processedExpense: any = { ...expense };
    
    // Garantir que a propriedade date seja uma instância Date válida
    if (processedExpense.date && !(processedExpense.date instanceof Date)) {
      try {
        processedExpense.date = new Date(processedExpense.date);
      } catch (e) {
        console.error("Erro convertendo date:", e);
        processedExpense.date = new Date();
      }
    }
    
    // Garantir que os metadados são instâncias Date válidas
    if (processedExpense.createdAt && !(processedExpense.createdAt instanceof Date)) {
      try {
        processedExpense.createdAt = new Date(processedExpense.createdAt);
      } catch (e) {
        console.error("Erro convertendo createdAt:", e);
        processedExpense.createdAt = new Date();
      }
    }
    
    if (processedExpense.updatedAt && !(processedExpense.updatedAt instanceof Date)) {
      try {
        processedExpense.updatedAt = new Date(processedExpense.updatedAt);
      } catch (e) {
        console.error("Erro convertendo updatedAt:", e);
        processedExpense.updatedAt = new Date();
      }
    }
    
    // Verificar se precisamos adicionar metadados caso não tenham sido fornecidos
    if (!processedExpense.createdAt) {
      processedExpense.createdAt = new Date();
    }
    
    if (!processedExpense.updatedAt) {
      processedExpense.updatedAt = new Date();
    }
    
    console.log("Inserindo despesa no banco de dados:", {
      ...processedExpense,
      date: processedExpense.date ? processedExpense.date.toISOString() : null,
      createdAt: processedExpense.createdAt ? processedExpense.createdAt.toISOString() : null,
      updatedAt: processedExpense.updatedAt ? processedExpense.updatedAt.toISOString() : null
    });
    
    const results = await db.insert(expenses).values(processedExpense).returning();
    return results[0];
  }

  async updateExpense(id: number, expenseData: Partial<InsertExpense>): Promise<void> {
    // Garantir que os campos de data estejam no formato correto
    const processedExpense: any = { ...expenseData };
    
    // Garantir que a propriedade date seja uma instância Date válida
    if (processedExpense.date && !(processedExpense.date instanceof Date)) {
      try {
        processedExpense.date = new Date(processedExpense.date);
      } catch (e) {
        console.error("Erro convertendo date:", e);
        delete processedExpense.date; // Remove se não pudermos converter
      }
    }
    
    // Adicionar updatedAt
    processedExpense.updatedAt = new Date();
    
    console.log("Atualizando despesa no banco de dados:", {
      ...processedExpense,
      date: processedExpense.date ? processedExpense.date.toISOString() : undefined,
      updatedAt: processedExpense.updatedAt.toISOString()
    });
    
    await db.update(expenses).set(processedExpense).where(eq(expenses.id, id));
  }

  async deleteExpense(id: number): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }
}

// Exporta a implementação de armazenamento
export const storage = new DatabaseStorage();
