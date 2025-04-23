import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table (using the existing one, plus CPF field)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  cpf: text("cpf"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  cpf: true,
});

// Trips table
export const trips = pgTable("trips", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  userId: integer("user_id").references(() => users.id),
  cpf: text("cpf"),
  // Metadados
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTripSchema = createInsertSchema(trips).pick({
  name: true,
  startDate: true,
  endDate: true,
  userId: true,
  cpf: true,
});

// Expenses table
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").references(() => trips.id).notNull(),
  date: timestamp("date").notNull(),
  destination: text("destination").notNull(),
  justification: text("justification").notNull(),
  // Refeições separadas
  breakfastValue: text("breakfast_value"),
  lunchValue: text("lunch_value"),
  dinnerValue: text("dinner_value"),
  // Transporte e outros
  transportValue: text("transport_value"),
  parkingValue: text("parking_value"),
  mileage: integer("mileage"),
  mileageValue: text("mileage_value"),
  otherValue: text("other_value"),
  otherDescription: text("other_description"),
  receipt: text("receipt").notNull(), // Base64 encoded image
  totalValue: text("total_value").notNull(),
  // Metadados
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expenses).pick({
  tripId: true,
  date: true,
  destination: true,
  justification: true,
  breakfastValue: true,
  lunchValue: true,
  dinnerValue: true,
  transportValue: true,
  parkingValue: true,
  mileage: true,
  mileageValue: true,
  otherValue: true,
  otherDescription: true,
  receipt: true,
  totalValue: true,
});

// Define types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof trips.$inferSelect;

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
