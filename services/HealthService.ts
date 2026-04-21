import { Platform } from 'react-native';
import AppleHealthKit, { HealthKitPermissions, HealthInputOptions } from 'react-native-health';
import {
  initialize,
  requestPermission,
  readRecords,
  getGrantedPermissions,
} from 'react-native-health-connect';

export class HealthService {
  static async hasPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        await initialize();
        const grantedPermissions = await getGrantedPermissions();
        return grantedPermissions && grantedPermissions.length > 0;
      } catch (error) {
        console.log('[HealthService] Erro ao verificar permissões:', error);
        return false;
      }
    }
    return false;
  }

  static async requestHealthPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        await initialize();
        const permissions = [
          { accessType: 'read', recordType: 'Steps' },
          { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
          { accessType: 'read', recordType: 'HeartRate' },
          { accessType: 'read', recordType: 'SleepSession' },
          { accessType: 'read', recordType: 'ExerciseSession' },
          { recordType: 'BackgroundAccessPermission' },
        ];
        // @ts-ignore
        const grantedPermissions = await requestPermission(permissions);
        return grantedPermissions.length > 0;
      } catch (error) {
        console.error('Error requesting Health Connect permissions:', error);
        return false;
      }
    } else if (Platform.OS === 'ios') {
      return new Promise((resolve) => {
        const permissions = {
          permissions: {
            read: [
              AppleHealthKit.Constants.Permissions.StepCount,
              AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
              AppleHealthKit.Constants.Permissions.HeartRate,
              AppleHealthKit.Constants.Permissions.SleepAnalysis,
              AppleHealthKit.Constants.Permissions.Workout,
            ],
            write: [],
          },
        } as HealthKitPermissions;

        AppleHealthKit.initHealthKit(permissions, (err: string | Object | null) => {
          if (err) {
            console.error('Error initializing HealthKit:', err);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    }
    return false;
  }

  /**
   * Calcula total de horas de sono a partir de uma lista de SleepSession records.
   * Aplica Interval Union para evitar double-counting de sessões sobrepostas.
   * Janela considerada: 20h do dia anterior até o momento atual.
   */
  static calculateSleepHours(sleepSessions: any[]): number {
    if (!sleepSessions || sleepSessions.length === 0) {
      console.log('[HealthService] Nenhuma SleepSession encontrada para calcular sono.');
      return 0;
    }

    // Monta lista de intervalos [startMs, endMs]
    const intervals: [number, number][] = [];
    for (const session of sleepSessions) {
      try {
        const startMs = new Date(session.startTime).getTime();
        const endMs = new Date(session.endTime).getTime();
        if (startMs && endMs && endMs > startMs) {
          intervals.push([startMs, endMs]);
        }
      } catch {
        // ignora sessões com datas inválidas
      }
    }

    if (intervals.length === 0) return 0;

    // Interval Union: ordena por início e mescla intervalos sobrepostos
    intervals.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [[...intervals[0]] as [number, number]];
    for (const [curStart, curEnd] of intervals.slice(1)) {
      const last = merged[merged.length - 1];
      if (curStart <= last[1]) {
        last[1] = Math.max(last[1], curEnd);
      } else {
        merged.push([curStart, curEnd]);
      }
    }

    // Soma total de ms e converte para horas (arredondado em 1 casa decimal)
    const totalMs = merged.reduce((acc, [s, e]) => acc + (e - s), 0);
    const totalHours = Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
    console.log(
      `[HealthService] Sono calculado: ${totalHours}h (${merged.length} bloco(s) mesclado(s) de ${sleepSessions.length} sessão(ões) bruta(s))`
    );
    return totalHours;
  }

  static async extractDailyData(): Promise<any> {
    const today = new Date();
    // Janela de atividade: 36h atrás para capturar o dia todo
    const last36h = new Date(today.getTime() - 36 * 60 * 60 * 1000);
    const isoStart = last36h.toISOString();
    const isoEnd = today.toISOString();

    // Janela específica para sono: 20h de ontem até agora (captura noite completa)
    const sleepWindowStart = new Date(today.getTime() - 20 * 60 * 60 * 1000).toISOString();

    const data = {
      steps: 0,
      activeCalories: 0,
      heartRateSamples: [] as any[],
      sleepSessions: [] as any[],
      workouts: [] as any[],
    };

    if (Platform.OS === 'android') {
      try {
        const steps = await readRecords('Steps', {
          timeRangeFilter: { operator: 'between', startTime: isoStart, endTime: isoEnd },
        });
        data.steps = steps.records.reduce((acc: number, curr: any) => acc + curr.count, 0);

        const calories = await readRecords('ActiveCaloriesBurned', {
          timeRangeFilter: { operator: 'between', startTime: isoStart, endTime: isoEnd },
        });
        data.activeCalories = calories.records.reduce(
          (acc: number, curr: any) => acc + curr.energy.inKilocalories,
          0
        );

        const hr = await readRecords('HeartRate', {
          timeRangeFilter: { operator: 'between', startTime: isoStart, endTime: isoEnd },
        });
        data.heartRateSamples = hr.records as any;

        // Janela de sono ampliada para capturar noite completa (20h atrás)
        const sleep = await readRecords('SleepSession', {
          timeRangeFilter: { operator: 'between', startTime: sleepWindowStart, endTime: isoEnd },
        });
        data.sleepSessions = sleep.records as any;
        console.log(`[HealthService] SleepSessions encontradas no Health Connect: ${data.sleepSessions.length}`);

        const workouts = await readRecords('ExerciseSession', {
          timeRangeFilter: { operator: 'between', startTime: isoStart, endTime: isoEnd },
        });
        data.workouts = workouts.records as any;
      } catch (err) {
        console.error('[HealthService] Health Connect read error:', err);
      }
    } else if (Platform.OS === 'ios') {
      try {
        const options: HealthInputOptions = {
          startDate: isoStart,
          endDate: isoEnd,
        };
        const sleepOptions: HealthInputOptions = {
          startDate: sleepWindowStart,
          endDate: isoEnd,
        };

        const getSteps = () =>
          new Promise<number>((resolve) =>
            AppleHealthKit.getDailyStepCountSamples(options, (err, res) =>
              resolve(res && res.length ? res.reduce((sum, item) => sum + item.value, 0) : 0)
            )
          );
        const getCalories = () =>
          new Promise<number>((resolve) =>
            AppleHealthKit.getActiveEnergyBurned(options, (err, res) =>
              resolve(res && res.length ? res.reduce((sum, item) => sum + item.value, 0) : 0)
            )
          );
        const getHeartRate = () =>
          new Promise<any[]>((resolve) =>
            AppleHealthKit.getHeartRateSamples(options, (err, res) => resolve(res || []))
          );
        const getSleep = () =>
          new Promise<any[]>((resolve) =>
            AppleHealthKit.getSleepSamples(sleepOptions, (err, res) => resolve(res || []))
          );
        const getWorkouts = () =>
          new Promise<any[]>((resolve) =>
            AppleHealthKit.getSamples({ ...options, type: 'Workout' as any }, (err, res) =>
              resolve(res || [])
            )
          );

        data.steps = await getSteps();
        data.activeCalories = await getCalories();
        data.heartRateSamples = await getHeartRate();
        data.sleepSessions = await getSleep();
        data.workouts = await getWorkouts();
      } catch (err) {
        console.error('[HealthService] HealthKit read error:', err);
      }
    }

    return data;
  }

  /**
   * Converte os dados raw do extractDailyData() para o formato
   * esperado pelo endpoint POST /api/health-sync/ do backend Marcão.
   *
   * Estrutura retornada:
   * {
   *   health_metrics_daily: { date, steps, active_calories, bpm_avg, sleep_hours },
   *   workout_sessions: [{ activity_type, duration_minutes, calories_burned, start_time }]
   * }
   */
  static formatPayloadForBackend(data: any): any {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // "YYYY-MM-DD"

    // Calcula BPM médio a partir das amostras de frequência cardíaca
    let bpmAvg = 0;
    if (data.heartRateSamples && data.heartRateSamples.length > 0) {
      const bpmValues = data.heartRateSamples
        .flatMap((record: any) => record.samples || [])
        .map((s: any) => s.beatsPerMinute || 0)
        .filter((bpm: number) => bpm > 30 && bpm < 220);
      if (bpmValues.length > 0) {
        bpmAvg = Math.round(
          bpmValues.reduce((a: number, b: number) => a + b, 0) / bpmValues.length
        );
      }
    }

    // Calcula horas de sono com Interval Union (principal novidade da correção)
    const sleepHours = HealthService.calculateSleepHours(data.sleepSessions || []);

    // Formata workout_sessions para o backend
    const workoutSessions = (data.workouts || []).map((w: any) => ({
      activity_type: w.exerciseType?.toString() || 'Unknown',
      duration_minutes:
        w.startTime && w.endTime
          ? Math.round(
              (new Date(w.endTime).getTime() - new Date(w.startTime).getTime()) / 60000
            )
          : 0,
      calories_burned: Math.round(w.energy?.inKilocalories || 0),
      start_time: w.startTime || new Date().toISOString(),
    }));

    return {
      health_metrics_daily: {
        date: dateStr,
        steps: Math.round(data.steps || 0),
        active_calories: Math.round(data.activeCalories || 0),
        bpm_avg: bpmAvg,
        sleep_hours: sleepHours,
      },
      workout_sessions: workoutSessions,
    };
  }
}
