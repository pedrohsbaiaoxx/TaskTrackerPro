import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configurar autenticação (cria as rotas /api/login, /api/register, /api/logout, /api/user)
  setupAuth(app);
  
  // Rota para buscar o CPF do usuário atual (usado para verificação)
  app.get("/api/user/cpf", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }
    
    // @ts-ignore - garantimos que o req.user existe com o req.isAuthenticated()
    const cpf = req.user?.cpf;
    res.status(200).json({ cpf });
  });
  
  // Rota para limpar o IndexedDB via API
  app.post("/api/clear-indexeddb", (req, res) => {
    // Esta rota é apenas um marcador para o cliente
    // A limpeza real acontece no navegador
    console.log("Solicitação para limpar o IndexedDB recebida");
    res.status(200).json({ message: "Solicitação para limpar IndexedDB recebida" });
  });
  
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
      // Autenticação não é necessária para buscar viagens por CPF
      // Isso é necessário para que os dispositivos móveis possam 
      // sincronizar mesmo sem estarem completamente autenticados
      
      const { cpf } = req.params;
      if (!cpf) {
        return res.status(400).json({ message: "CPF é obrigatório" });
      }
      
      // Log para debug
      console.log(`Buscando viagens para o CPF ${cpf} no servidor`);
      
      // Buscamos direto do banco de dados usando o Drizzle
      const trips = await storage.getTripsByCpf(cpf);
      console.log(`Encontradas ${trips.length} viagens para o CPF ${cpf}`);
      
      // Formatamos as datas para garantir que sejam compatíveis
      const formattedTrips = trips.map(trip => {
        // Verificamos se o trip tem a propriedade createdAt antes de tentar usá-la
        const createdAt = trip.createdAt ? new Date(trip.createdAt).toISOString() : new Date().toISOString();
        
        return {
          ...trip,
          startDate: trip.startDate ? new Date(trip.startDate).toISOString() : null,
          endDate: trip.endDate ? new Date(trip.endDate).toISOString() : null,
          createdAt: createdAt
        };
      });
      
      res.json(formattedTrips);
    } catch (error) {
      console.error(`Erro ao buscar viagens por CPF: ${error}`);
      next(error);
    }
  });
  
  // Nova rota para buscar todas as despesas de uma viagem por ID
  app.get("/api/expenses/by-trip/:tripId", async (req, res, next) => {
    try {
      const { tripId } = req.params;
      if (!tripId) {
        return res.status(400).json({ message: "ID da viagem é obrigatório" });
      }
      
      const tripIdNum = parseInt(tripId);
      console.log(`Buscando despesas para a viagem ${tripIdNum} no servidor`);
      
      // Buscamos direto do banco de dados
      try {
        // Primeiro tentamos usar o storage
        const expenses = await storage.getExpensesByTripId(tripIdNum);
        console.log(`Encontradas ${expenses.length} despesas para a viagem ${tripIdNum}`);
        
        // Verificamos se as despesas têm campos createdAt
        const formattedExpenses = expenses.map(expense => {
          // Garantimos que o objeto de retorno tenha todos os campos necessários
          const createdAt = expense.createdAt 
            ? new Date(expense.createdAt).toISOString() 
            : new Date().toISOString();
            
          const updatedAt = expense.updatedAt 
            ? new Date(expense.updatedAt).toISOString() 
            : createdAt;
            
          return {
            ...expense,
            date: expense.date ? new Date(expense.date).toISOString() : null,
            createdAt: createdAt,
            updatedAt: updatedAt
          };
        });
        
        res.json(formattedExpenses);
      } catch (storageError) {
        console.error(`Erro no storage ao buscar despesas: ${storageError}`);
        
        // Se falhar, tentamos buscar diretamente usando SQL
        try {
          const { db } = await import('./db');
          const { expenses } = await import('@shared/schema');
          const { eq } = await import('drizzle-orm');
          
          // Buscar despesas diretamente do banco
          const dbResult = await db.select().from(expenses).where(eq(expenses.tripId, tripIdNum));
          
          console.log(`Encontradas ${dbResult.length} despesas via SQL para a viagem ${tripIdNum}`);
          
          // Formatamos as datas
          const formattedExpenses = dbResult.map((expense: any) => {
            const createdAt = expense.createdAt 
              ? new Date(expense.createdAt).toISOString() 
              : new Date().toISOString();
              
            const updatedAt = expense.updatedAt 
              ? new Date(expense.updatedAt).toISOString() 
              : createdAt;
              
            return {
              ...expense,
              date: expense.date ? new Date(expense.date).toISOString() : null,
              createdAt: createdAt,
              updatedAt: updatedAt
            };
          });
          
          res.json(formattedExpenses);
        } catch (sqlError) {
          console.error(`Erro ao consultar SQL: ${sqlError}`);
          throw sqlError;
        }
      }
    } catch (error) {
      console.error(`Erro ao buscar despesas por viagem: ${error}`);
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
      console.log("POST /api/trips - Recebendo nova viagem:", req.body);
      
      // Processar as datas antes de salvar
      const { startDate, endDate, cpf, ...restBody } = req.body;
      
      // Convertendo datas para formato compatível com PostgreSQL
      const processedStartDate = startDate ? new Date(startDate) : null;
      const processedEndDate = endDate ? new Date(endDate) : null;
      
      console.log("Processando viagem antes de salvar no BD:");
      console.log("- StartDate original:", startDate);
      console.log("- StartDate processado:", processedStartDate);
      console.log("- EndDate original:", endDate);
      console.log("- EndDate processado:", processedEndDate);
      console.log("- CPF:", cpf);
      console.log("- Campos restantes:", restBody);
      
      if (!cpf) {
        console.log("ERRO: CPF não fornecido");
        return res.status(400).json({ message: "CPF é obrigatório" });
      }
      
      let userId = null;
      
      // Verificar se já existe um usuário com esse CPF
      const existingUser = await storage.getUserByCpf(cpf);
      
      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Criar um novo usuário com esse CPF
        const newUser = await storage.createUser({
          username: `user_${Date.now()}`,
          password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
          cpf: cpf
        });
        userId = newUser.id;
      }
      
      const tripData = {
        ...restBody,
        startDate: processedStartDate,
        endDate: processedEndDate,
        cpf,  // salvar o CPF diretamente na viagem
        userId // referência ao usuário
      };
      
      const trip = await storage.createTrip(tripData);
      res.status(201).json(trip);
    } catch (error) {
      console.error("Erro ao criar viagem:", error);
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

      // Processar as datas antes de atualizar
      const { startDate, endDate, ...restBody } = req.body;
      
      // Convertendo datas para formato compatível com PostgreSQL
      const processedStartDate = startDate ? new Date(startDate) : null;
      const processedEndDate = endDate ? new Date(endDate) : null;
      
      console.log("Processando viagem antes de atualizar no BD:");
      console.log("- StartDate original:", startDate);
      console.log("- StartDate processado:", processedStartDate);
      console.log("- EndDate original:", endDate);
      console.log("- EndDate processado:", processedEndDate);
      
      const tripData = {
        ...restBody,
        startDate: processedStartDate,
        endDate: processedEndDate
      };
      
      await storage.updateTrip(tripId, tripData);
      res.status(200).json({ message: "Viagem atualizada com sucesso" });
    } catch (error) {
      console.error("Erro ao atualizar viagem:", error);
      next(error);
    }
  });
  
  app.delete("/api/trips/:id", async (req, res, next) => {
    try {
      // Removida verificação de autenticação para permitir exclusão via CPF
      const tripId = parseInt(req.params.id);
      console.log(`Solicitação para excluir viagem ${tripId}`);
      
      // Verificar se a viagem existe
      const trip = await storage.getTrip(tripId);
      
      if (!trip) {
        console.log(`Viagem ${tripId} não encontrada`);
        return res.status(404).json({ message: "Viagem não encontrada" });
      }
      
      // Importar o módulo db diretamente para controle total da transação
      const { pool } = await import('./db');
      
      // Iniciar uma transação para garantir a integridade dos dados
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // 1. Primeiro excluir todas as despesas associadas a esta viagem
        console.log(`Excluindo todas as despesas da viagem ${tripId}`);
        await client.query('DELETE FROM expenses WHERE trip_id = $1', [tripId]);
        
        // 2. Depois excluir a viagem
        console.log(`Excluindo a viagem ${tripId}`);
        await client.query('DELETE FROM trips WHERE id = $1', [tripId]);
        
        // Commit da transação
        await client.query('COMMIT');
        console.log(`Viagem ${tripId} excluída com sucesso`);
        
        res.status(200).json({ message: "Viagem excluída com sucesso" });
      } catch (err) {
        // Rollback em caso de erro
        await client.query('ROLLBACK');
        console.error(`Erro ao excluir viagem ${tripId}:`, err);
        throw err;
      } finally {
        // Liberar o cliente de volta para o pool
        client.release();
      }
    } catch (error) {
      console.error("Erro ao excluir viagem:", error);
      next(error);
    }
  });
  
  // Rotas de despesas
  app.get("/api/trips/:tripId/expenses", async (req, res, next) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const trip = await storage.getTrip(tripId);
      
      if (!trip) {
        return res.status(404).json({ message: "Viagem não encontrada" });
      }
      
      const expenses = await storage.getExpensesByTripId(tripId);
      res.json(expenses);
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/trips/:tripId/expenses", async (req, res, next) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const trip = await storage.getTrip(tripId);
      
      if (!trip) {
        return res.status(404).json({ message: "Viagem não encontrada" });
      }
      
      // Extrair os dados do corpo da requisição
      const {
        date: dateStr,
        destination = '',
        justification = '',
        breakfastValue = '0',
        lunchValue = '0',
        dinnerValue = '0',
        transportValue = '0',
        parkingValue = '0',
        mileage = 0,
        mileageValue = '0',
        otherValue = '0',
        otherDescription = '',
        receipt = '',
        totalValue = '0'
      } = req.body;
      
      console.log("Tentando criar despesa com dados:", {
        tripId,
        dateStr,
        destination
      });
      
      // Importar o módulo db diretamente para evitar problemas com o ORM
      const { pool } = await import('./db');
      
      // Usar SQL direto para inserir dados, com maior controle sobre tipos
      const insertQuery = `
        INSERT INTO expenses (
          trip_id, date, destination, justification, 
          breakfast_value, lunch_value, dinner_value, 
          transport_value, parking_value, mileage, mileage_value,
          other_value, other_description, receipt, total_value,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()
        ) RETURNING *
      `;
      
      // Converter a data manualmente
      let parsedDate;
      try {
        parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          parsedDate = new Date(); // Usar data atual se a conversão falhar
        }
      } catch (e) {
        console.error("Erro ao converter data:", e);
        parsedDate = new Date();
      }
      
      // Valores para os placeholders na query
      const values = [
        tripId,
        parsedDate,
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
      ];
      
      console.log("Executando SQL de inserção com data:", parsedDate);
      
      // Executar a query diretamente
      const result = await pool.query(insertQuery, values);
      const expense = result.rows[0];
      
      console.log("Despesa criada com sucesso:", expense);
      
      res.status(201).json(expense);
    } catch (error) {
      console.error("Erro ao criar despesa:", error);
      next(error);
    }
  });
  
  app.put("/api/expenses/:id", async (req, res, next) => {
    try {
      const expenseId = parseInt(req.params.id);
      const expense = await storage.getExpense(expenseId);
      
      if (!expense) {
        return res.status(404).json({ message: "Despesa não encontrada" });
      }
      
      const trip = await storage.getTrip(expense.tripId);
      
      if (!trip) {
        return res.status(404).json({ message: "Viagem não encontrada" });
      }
      
      await storage.updateExpense(expenseId, req.body);
      res.status(200).json({ message: "Despesa atualizada com sucesso" });
    } catch (error) {
      next(error);
    }
  });
  
  app.delete("/api/expenses/:id", async (req, res, next) => {
    try {
      const expenseId = parseInt(req.params.id);
      
      // Importar o módulo db diretamente para evitar problemas com o ORM
      const { pool } = await import('./db');
      
      // Primeiro, verificamos se a despesa existe
      const checkQuery = `
        SELECT e.id, e.trip_id
        FROM expenses e
        WHERE e.id = $1
      `;
      
      const checkResult = await pool.query(checkQuery, [expenseId]);
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ message: "Despesa não encontrada" });
      }
      
      // Executar a query de exclusão diretamente
      const deleteQuery = `DELETE FROM expenses WHERE id = $1`;
      await pool.query(deleteQuery, [expenseId]);
      
      console.log(`Despesa ${expenseId} excluída com sucesso`);
      
      res.status(200).json({ message: "Despesa excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir despesa:", error);
      next(error);
    }
  });

  // Rota para excluir todas as despesas de uma viagem
  app.delete("/api/trips/:tripId/expenses", async (req, res, next) => {
    try {
      const tripId = parseInt(req.params.tripId);
      if (isNaN(tripId)) {
        return res.status(400).json({ message: "ID de viagem inválido" });
      }
      
      // Buscar todas as despesas da viagem
      const expenses = await storage.getExpensesByTripId(tripId);
      console.log(`Encontradas ${expenses.length} despesas para a viagem ${tripId}`);
      
      // Excluir cada despesa individualmente
      for (const expense of expenses) {
        await storage.deleteExpense(expense.id);
      }
      
      console.log(`Excluídas ${expenses.length} despesas da viagem ${tripId}`);
      res.status(200).json({ 
        message: `${expenses.length} despesas excluídas com sucesso`,
        count: expenses.length
      });
    } catch (error) {
      console.error("Erro ao excluir despesas da viagem:", error);
      next(error);
    }
  });
  
  // Rota para limpar o banco de dados completamente
  app.delete("/api/reset-database", async (req, res, next) => {
    try {
      console.log("Iniciando limpeza do banco de dados...");
      
      // 1. Obter todas as viagens
      const trips = await storage.getAllTrips();
      console.log(`Encontradas ${trips.length} viagens para limpeza.`);
      
      // 2. Para cada viagem, excluir todas as despesas relacionadas
      for (const trip of trips) {
        try {
          // Primeiro, buscamos todas as despesas desta viagem
          const expenses = await storage.getExpensesByTripId(trip.id);
          console.log(`Encontradas ${expenses.length} despesas para a viagem ${trip.id}`);
          
          // Excluímos cada despesa individualmente
          for (const expense of expenses) {
            await storage.deleteExpense(expense.id);
          }
          
          console.log(`Excluídas ${expenses.length} despesas da viagem ${trip.id}`);
        } catch (error) {
          console.error(`Erro ao excluir despesas da viagem ${trip.id}:`, error);
        }
      }
      
      // 3. Excluir cada viagem
      let tripDeleted = 0;
      for (const trip of trips) {
        try {
          await storage.deleteTrip(trip.id);
          tripDeleted++;
        } catch (error) {
          console.error(`Erro ao excluir viagem ${trip.id}:`, error);
        }
      }
      
      console.log(`Excluídas ${tripDeleted} viagens com sucesso.`);
      res.status(200).json({
        message: "Banco de dados limpo com sucesso",
        trips_deleted: tripDeleted
      });
    } catch (error) {
      console.error("Erro ao limpar banco de dados:", error);
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
