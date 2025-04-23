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
    console.log("Iniciando verificação completa e correção do banco de dados");
    
    // Buscar dados do servidor primeiro para ter referência definitiva
    console.log("Buscando dados do servidor para CPF:", cpf);
    const response = await fetch(`/api/trips/by-cpf/${cpf}`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      console.error(`Erro ao buscar viagens do servidor: ${response.status}`);
      return false;
    }
    
    const serverTrips = await response.json();
    console.log(`Servidor tem ${serverTrips.length} viagens para CPF ${cpf}`);
    
    // Primeiramente, limpar o banco de dados local completamente
    await clearLocalDatabase();
    console.log("Banco de dados local limpo completamente");
    
    // Se não houver viagens no servidor, estamos prontos
    if (serverTrips.length === 0) {
      console.log("Nenhuma viagem no servidor, banco de dados está consistente");
      return true;
    }
    
    // Obter conexão com o banco de dados recém-criado
    const db = await getDB();
    
    // Para cada viagem do servidor
    for (const serverTrip of serverTrips) {
      try {
        console.log(`Processando viagem ${serverTrip.id} do servidor`);
        
        // Converter datas para objetos Date
        const tripData = {
          ...serverTrip,
          createdAt: new Date(serverTrip.createdAt || new Date()),
          startDate: serverTrip.startDate ? new Date(serverTrip.startDate) : null,
          endDate: serverTrip.endDate ? new Date(serverTrip.endDate) : null
        };
        
        // Salvar a viagem no IndexedDB
        const tripTransaction = db.transaction(["trips"], "readwrite");
        const tripStore = tripTransaction.objectStore("trips");
        
        await new Promise<void>((resolve, reject) => {
          const addRequest = tripStore.add(tripData);
          addRequest.onsuccess = () => resolve();
          addRequest.onerror = (e) => {
            console.error(`Erro ao adicionar viagem ${serverTrip.id}:`, e);
            reject(new Error(`Falha ao adicionar viagem ${serverTrip.id}`));
          };
          tripTransaction.oncomplete = () => resolve();
        });
        
        // Buscar as despesas para esta viagem
        console.log(`Buscando despesas da viagem ${serverTrip.id}`);
        const expensesResponse = await fetch(`/api/expenses/by-trip/${serverTrip.id}`, {
          credentials: 'include'
        });
        
        if (expensesResponse.ok) {
          const serverExpenses = await expensesResponse.json();
          console.log(`Servidor tem ${serverExpenses.length} despesas para viagem ${serverTrip.id}`);
          
          if (serverExpenses.length > 0) {
            const expensesTransaction = db.transaction(["expenses"], "readwrite");
            const expensesStore = expensesTransaction.objectStore("expenses");
            
            // Adicionar cada despesa no banco local
            for (const expense of serverExpenses) {
              try {
                const expenseData = {
                  ...expense,
                  date: new Date(expense.date),
                  createdAt: new Date(expense.createdAt || new Date())
                };
                
                await new Promise<void>((resolve, reject) => {
                  const addRequest = expensesStore.add(expenseData);
                  addRequest.onsuccess = () => resolve();
                  addRequest.onerror = (e) => {
                    console.error(`Erro ao adicionar despesa ${expense.id}:`, e);
                    reject(e);
                  };
                });
              } catch (expenseError) {
                console.warn(`Erro ao processar despesa ${expense.id}:`, expenseError);
                // Continue com a próxima despesa mesmo se uma falhar
              }
            }
            
            await new Promise<void>(resolve => {
              expensesTransaction.oncomplete = () => resolve();
            });
            
            console.log(`Salvas ${serverExpenses.length} despesas localmente para viagem ${serverTrip.id}`);
          }
        } else {
          console.warn(`Erro ao buscar despesas do servidor: ${expensesResponse.status}`);
        }
      } catch (tripError) {
        console.error(`Erro ao processar viagem ${serverTrip.id}:`, tripError);
        // Continue com a próxima viagem mesmo se uma falhar
      }
    }
    
    console.log("Verificação e correção concluídas: banco de dados agora reflete exatamente o servidor");
    return true;
  } catch (error) {
    console.error("Erro crítico ao verificar e corrigir banco de dados:", error);
    
    // Tenta uma abordagem mais simples como fallback
    try {
      console.log("Tentando abordagem alternativa de recuperação");
      await clearLocalDatabase();
      await syncTripsFromServer(cpf);
      return true;
    } catch (fallbackError) {
      console.error("Falha na recuperação de emergência:", fallbackError);
      return false;
    }
  } finally {
    // Certifica-se de fechar a conexão com o banco
    try {
      const db = await getDB();
      db.close();
    } catch (closeError) {
      // ignora erros ao fechar
    }
  }
}