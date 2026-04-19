import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as SecureStore from 'expo-secure-store';
import { HealthService } from './HealthService';
import api from './api';

const MARCAO_HEALTH_SYNC = 'MARCAO_HEALTH_SYNC';

// A definição da TASK deve estar sempre no escopo global para evitar crashes no Android 14
TaskManager.defineTask(MARCAO_HEALTH_SYNC, async () => {
  try {
    console.log("[Background Sync] Iniciando tarefa...");
    const token = await SecureStore.getItemAsync('jwt_token');
    
    if (!token) {
      console.log("[Background Sync] Abortando: Token não encontrado.");
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const data = await HealthService.extractDailyData();

    await api.post('/api/health-sync', data, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[Background Sync] [${timestamp}] Sucesso: Dados enviados.`);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error: any) {
    console.error('[Background Sync] Erro fatal durante a execução:', error);
    // Retornamos Failed para que o OS possa tentar novamente mais tarde se desejar
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(MARCAO_HEALTH_SYNC);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(MARCAO_HEALTH_SYNC, {
        minimumInterval: 60 * 60, // 1 hora em segundos (conforme solicitado pelo usuário)
        stopOnTerminate: false, // Continue rodando se o app for fechado
        startOnBoot: true, // Iniciar quando o celular reiniciar
      });
      console.log('Background Sync task registered (1h interval)!');
    } else {
      console.log('Background Sync already registered.');
    }
  } catch (err) {
    console.error('Background Sync registration failed:', err);
  }
}
