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
    const results = await db.insert(trips).values(trip).returning();
    return results[0];
  }

  async updateTrip(id: number, tripData: Partial<InsertTrip>): Promise<void> {
    await db.update(trips).set(tripData).where(eq(trips.id, id));
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
    const results = await db.insert(expenses).values(expense).returning();
    return results[0];
  }

  async updateExpense(id: number, expenseData: Partial<InsertExpense>): Promise<void> {
    await db.update(expenses).set(expenseData).where(eq(expenses.id, id));
  }

  async deleteExpense(id: number): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }
}

// Exporta a implementação de armazenamento
export const storage = new DatabaseStorage();
