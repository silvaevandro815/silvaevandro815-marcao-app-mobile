import { Platform } from 'react-native';
import AppleHealthKit, { HealthKitPermissions, HealthInputOptions } from 'react-native-health';
import {
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';

export class HealthService {
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

  static async extractDailyData(): Promise<any> {
    const today = new Date();
    const last24h = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    const isoStart = last24h.toISOString();
    const isoEnd = today.toISOString();

    const data = {
      steps: 0,
      activeCalories: 0,
      heartRateSamples: [] as any[],
      sleepSessions: [] as any[],
      workouts: [] as any[]
    };

    if (Platform.OS === 'android') {
      try {
        const steps = await readRecords('Steps', { timeRangeFilter: { operator: 'between', startTime: isoStart, endTime: isoEnd } });
        data.steps = steps.records.reduce((acc: number, curr: any) => acc + curr.count, 0);

        const calories = await readRecords('ActiveCaloriesBurned', { timeRangeFilter: { operator: 'between', startTime: isoStart, endTime: isoEnd } });
        data.activeCalories = calories.records.reduce((acc: number, curr: any) => acc + curr.energy.inKilocalories, 0);

        const hr = await readRecords('HeartRate', { timeRangeFilter: { operator: 'between', startTime: isoStart, endTime: isoEnd } });
        data.heartRateSamples = hr.records as any;

        const sleep = await readRecords('SleepSession', { timeRangeFilter: { operator: 'between', startTime: isoStart, endTime: isoEnd } });
        data.sleepSessions = sleep.records as any;

        const workouts = await readRecords('ExerciseSession', { timeRangeFilter: { operator: 'between', startTime: isoStart, endTime: isoEnd } });
        data.workouts = workouts.records as any;
      } catch (err) {
        console.error("Health Connect read error", err);
      }
    } else if (Platform.OS === 'ios') {
      try {
        const options: HealthInputOptions = {
          startDate: isoStart,
          endDate: isoEnd,
        };

        const getSteps = () => new Promise<number>((resolve) => AppleHealthKit.getDailyStepCountSamples(options, (err, res) => resolve(res && res.length ? res.reduce((sum, item) => sum + item.value, 0) : 0)));
        const getCalories = () => new Promise<number>((resolve) => AppleHealthKit.getActiveEnergyBurned(options, (err, res) => resolve(res && res.length ? res.reduce((sum, item) => sum + item.value, 0) : 0)));
        const getHeartRate = () => new Promise<any[]>((resolve) => AppleHealthKit.getHeartRateSamples(options, (err, res) => resolve(res || [])));
        const getSleep = () => new Promise<any[]>((resolve) => AppleHealthKit.getSleepSamples(options, (err, res) => resolve(res || [])));
        const getWorkouts = () => new Promise<any[]>((resolve) => AppleHealthKit.getSamples({ ...options, type: 'Workout' as any }, (err, res) => resolve(res || [])));

        data.steps = await getSteps();
        data.activeCalories = await getCalories();
        data.heartRateSamples = await getHeartRate();
        data.sleepSessions = await getSleep();
        data.workouts = await getWorkouts();
      } catch (err) {
        console.error("HealthKit read error", err);
      }
    }

    return data;
  }
}
