import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configurar autenticação (cria as rotas /api/login, /api/register, /api/logout, /api/user)
  setupAuth(app);
  
  // Rotas de viagens
  app.get("/api/trips", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autorizado" });
      }
      
      // @ts-ignore - garantimos que o req.user existe com o req.isAuthenticated()
      const userId = req.user.id;
      const trips = await storage.getTripsByUserId(userId);
      res.json(trips);
    } catch (error) {
      next(error);
    }
  });
  
  // Rota para buscar viagens pelo CPF
  app.get("/api/trips/by-cpf/:cpf", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autorizado" });
      }
      
      const { cpf } = req.params;
      if (!cpf) {
        return res.status(400).json({ message: "CPF é obrigatório" });
      }
      
      const trips = await storage.getTripsByCpf(cpf);
      res.json(trips);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/trips/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autorizado" });
      }
      
      const tripId = parseInt(req.params.id);
      const trip = await storage.getTrip(tripId);
      
      if (!trip) {
        return res.status(404).json({ message: "Viagem não encontrada" });
      }
      
      // @ts-ignore - garantimos que o req.user existe com o req.isAuthenticated()
      if (trip.userId !== req.user.id) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      res.json(trip);
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/trips", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autorizado" });
      }
      
      // @ts-ignore - garantimos que o req.user existe com o req.isAuthenticated()
      const userId = req.user.id;
      const tripData = {
        ...req.body,
        userId
      };
      
      const trip = await storage.createTrip(tripData);
      res.status(201).json(trip);
    } catch (error) {
      next(error);
    }
  });
  
  app.put("/api/trips/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autorizado" });
      }
      
      const tripId = parseInt(req.params.id);
      const trip = await storage.getTrip(tripId);
      
      if (!trip) {
        return res.status(404).json({ message: "Viagem não encontrada" });
      }
      
      // @ts-ignore - garantimos que o req.user existe com o req.isAuthenticated()
      if (trip.userId !== req.user.id) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      await storage.updateTrip(tripId, req.body);
      res.status(200).json({ message: "Viagem atualizada com sucesso" });
    } catch (error) {
      next(error);
    }
  });
  
  app.delete("/api/trips/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autorizado" });
      }
      
      const tripId = parseInt(req.params.id);
      const trip = await storage.getTrip(tripId);
      
      if (!trip) {
        return res.status(404).json({ message: "Viagem não encontrada" });
      }
      
      // @ts-ignore - garantimos que o req.user existe com o req.isAuthenticated()
      if (trip.userId !== req.user.id) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      await storage.deleteTrip(tripId);
      res.status(200).json({ message: "Viagem excluída com sucesso" });
    } catch (error) {
      next(error);
    }
  });
  
  // Rotas de despesas
  app.get("/api/trips/:tripId/expenses", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autorizado" });
      }
      
      const tripId = parseInt(req.params.tripId);
      const trip = await storage.getTrip(tripId);
      
      if (!trip) {
        return res.status(404).json({ message: "Viagem não encontrada" });
      }
      
      // @ts-ignore - garantimos que o req.user existe com o req.isAuthenticated()
      if (trip.userId !== req.user.id) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const expenses = await storage.getExpensesByTripId(tripId);
      res.json(expenses);
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/trips/:tripId/expenses", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autorizado" });
      }
      
      const tripId = parseInt(req.params.tripId);
      const trip = await storage.getTrip(tripId);
      
      if (!trip) {
        return res.status(404).json({ message: "Viagem não encontrada" });
      }
      
      // @ts-ignore - garantimos que o req.user existe com o req.isAuthenticated()
      if (trip.userId !== req.user.id) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const expenseData = {
        ...req.body,
        tripId
      };
      
      const expense = await storage.createExpense(expenseData);
      res.status(201).json(expense);
    } catch (error) {
      next(error);
    }
  });
  
  app.put("/api/expenses/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autorizado" });
      }
      
      const expenseId = parseInt(req.params.id);
      const expense = await storage.getExpense(expenseId);
      
      if (!expense) {
        return res.status(404).json({ message: "Despesa não encontrada" });
      }
      
      const trip = await storage.getTrip(expense.tripId);
      
      if (!trip) {
        return res.status(404).json({ message: "Viagem não encontrada" });
      }
      
      // @ts-ignore - garantimos que o req.user existe com o req.isAuthenticated()
      if (trip.userId !== req.user.id) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      await storage.updateExpense(expenseId, req.body);
      res.status(200).json({ message: "Despesa atualizada com sucesso" });
    } catch (error) {
      next(error);
    }
  });
  
  app.delete("/api/expenses/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autorizado" });
      }
      
      const expenseId = parseInt(req.params.id);
      const expense = await storage.getExpense(expenseId);
      
      if (!expense) {
        return res.status(404).json({ message: "Despesa não encontrada" });
      }
      
      const trip = await storage.getTrip(expense.tripId);
      
      if (!trip) {
        return res.status(404).json({ message: "Viagem não encontrada" });
      }
      
      // @ts-ignore - garantimos que o req.user existe com o req.isAuthenticated()
      if (trip.userId !== req.user.id) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      await storage.deleteExpense(expenseId);
      res.status(200).json({ message: "Despesa excluída com sucesso" });
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
