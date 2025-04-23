import { TripData, ExpenseData, getTripsByCpf } from "./expenseStore";

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
    console.log("Limpando banco de dados local para sincronização...");
    
    return new Promise<boolean>((resolve) => {
      // Abre uma conexão e deleta o banco de dados inteiro
      const deleteRequest = indexedDB.deleteDatabase("ExpenseTrackerDB");
      
      deleteRequest.onsuccess = () => {
        console.log("Banco de dados local limpo com sucesso");
        resolve(true);
      };
      
      deleteRequest.onerror = () => {
        console.error("Erro ao limpar banco de dados local:", deleteRequest.error);
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

// Função para verificar e reparar o banco de dados
export async function verifyAndFixDatabase(cpf: string): Promise<boolean> {
  try {
    console.log("Iniciando verificação do banco de dados...");
    
    // Primeiro, verifica quantas viagens temos localmente
    const localTrips = await getTripsByCpf(cpf);
    console.log(`Verificação: ${localTrips.length} viagens encontradas localmente`);
    
    // Agora verifica quantas viagens o servidor tem
    const response = await fetch(`/api/trips/by-cpf/${cpf}`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      console.error(`Erro ao buscar viagens do servidor: ${response.status}`);
      return false;
    }
    
    const serverTrips = await response.json();
    console.log(`Verificação: ${serverTrips.length} viagens encontradas no servidor`);
    
    // Compara os dados de ambas as fontes
    const localIds = new Set(localTrips.map((t: any) => t.id));
    const serverIds = new Set(serverTrips.map((t: any) => t.id));
    
    // Verifica se existem viagens no servidor que não estão no local
    const missingLocally = Array.from(serverIds).filter((id: any) => !localIds.has(id));
    
    if (missingLocally.length > 0) {
      console.log(`Detectadas ${missingLocally.length} viagens faltando localmente`);
      
      // Limpa o banco de dados local e sincroniza novamente
      console.log("Iniciando limpeza e ressincronização...");
      await clearLocalDatabase();
      await syncTripsFromServer(cpf);
      return true;
    }
    
    // Tudo parece ok
    console.log("Verificação concluída: banco de dados parece consistente");
    return true;
  } catch (error) {
    console.error("Erro ao verificar e reparar banco de dados:", error);
    return false;
  }
}