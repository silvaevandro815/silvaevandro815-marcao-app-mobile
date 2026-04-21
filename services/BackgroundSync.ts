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

    // 1. Extrai os dados brutos do Health Connect / HealthKit
    const rawData = await HealthService.extractDailyData();

    // 2. Formata o payload no formato esperado pelo backend (/api/health-sync/)
    //    CORREÇÃO CRÍTICA: inclui sleep_hours calculado via Interval Union
    const formattedPayload = HealthService.formatPayloadForBackend(rawData);

    console.log(
      `[Background Sync] Payload formatado: passos=${formattedPayload.health_metrics_daily.steps}, ` +
      `sono=${formattedPayload.health_metrics_daily.sleep_hours}h, ` +
      `bpm=${formattedPayload.health_metrics_daily.bpm_avg}, ` +
      `treinos=${formattedPayload.workout_sessions.length}`
    );

    // 3. Envia ao backend com autenticação JWT
    await api.post('/api/health-sync/', formattedPayload);
    
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[Background Sync] [${timestamp}] Sucesso: Dados enviados ao Marcão.`);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error: any) {
    console.log('[Background Sync] Erro capturado (evitando crash global):', error?.message || error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(MARCAO_HEALTH_SYNC);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(MARCAO_HEALTH_SYNC, {
        minimumInterval: 60 * 60, // 1 hora em segundos
        stopOnTerminate: false,   // Continua rodando quando o app é fechado
        startOnBoot: true,        // Reinicia quando o celular liga
      });
      console.log('[Background Sync] Task registrada com sucesso (intervalo: 1h).');
    } else {
      console.log('[Background Sync] Task já registrada.');
    }
  } catch (err) {
    console.error('[Background Sync] Falha ao registrar task:', err);
  }
}
