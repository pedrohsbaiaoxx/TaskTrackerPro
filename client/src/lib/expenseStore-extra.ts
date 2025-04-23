// Função para obter viagens apenas do IndexedDB local
export async function getLocalTripsByCpf(cpf: string): Promise<TripData[]> {
  try {
    const db = await getDB();
    const transaction = db.transaction([TRIPS_STORE], "readonly");
    const store = transaction.objectStore(TRIPS_STORE);
    const index = store.index("cpf");
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(cpf);
      request.onerror = () => {
        console.error("Erro ao buscar viagens do IndexedDB:", request.error);
        reject(request.error);
      };
      request.onsuccess = () => {
        console.log(`Encontradas ${request.result.length} viagens no IndexedDB`);
        // Ordena por data de criação, mais recente primeiro
        const localTrips = request.result as TripData[];
        localTrips.sort((a, b) => {
          // Adiciona verificação para evitar erro se createdAt for indefinido
          const timeA = a.createdAt ? a.createdAt.getTime() : 0;
          const timeB = b.createdAt ? b.createdAt.getTime() : 0;
          return timeB - timeA;
        });
        resolve(localTrips);
      };
      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error("Não foi possível obter viagens locais:", error);
    // Se algo der errado, retorna uma lista vazia
    return [];
  }
}