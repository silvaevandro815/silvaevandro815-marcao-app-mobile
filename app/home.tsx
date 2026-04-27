import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { executeSyncCycle, registerAppStateSync, unregisterAppStateSync } from '../services/BackgroundSync';
import api from '../services/api';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
interface SleepData {
  has_data: boolean;
  is_fresh: boolean;
  avg_hours: number;
  days_with_data: number;
  quality: 'SEM_DADOS' | 'CRITICO' | 'INSUFICIENTE' | 'BOM' | 'EXCELENTE';
  quality_emoji: string;
  quality_color: string;
  quality_label: string;
  tip: string;
  personal_tip: string;
}
interface DashboardData {
  profile: {
    name: string;
    first_name: string;
    goal: string;
    sport: string;
    age: number;
    weight: number;
    height: number;
    imc: number | null;
    imc_category: string | null;
    gender: string;
    member_since: string | null;
    days_on_platform: number;
    streak: number;
    streak_label: string;
    streak_pct: number;
    hydration_ml: number;
    profile_picture_url: string | null;
    next_photo_date: string | null;
  };
  weekly_stats: {
    steps: number;
    workouts: number;
    calories: number;
    avg_hr: number;
  };
  sleep: SleepData;
}

// ─── Sleep Card ───────────────────────────────────────────────────────────────
function SleepCard({ sleep }: { sleep: SleepData }) {
  const bgColor = sleep.has_data
    ? `${sleep.quality_color}18`
    : 'rgba(100,116,139,0.1)';
  const borderColor = sleep.has_data ? `${sleep.quality_color}55` : 'rgba(100,116,139,0.3)';

  return (
    <View style={[styles.sleepCard, { backgroundColor: bgColor, borderColor }]}>
      <View style={styles.sleepHeader}>
        <Text style={styles.sleepEmoji}>{sleep.quality_emoji}</Text>
        <View style={styles.sleepHeaderText}>
          <Text style={styles.sleepTitle}>Sono da Semana</Text>
          <Text style={[styles.sleepQualityLabel, { color: sleep.quality_color }]}>
            {sleep.quality_label.toUpperCase()}
            {sleep.has_data ? ` · ${sleep.avg_hours}h/noite` : ''}
          </Text>
        </View>
        {sleep.has_data && (
          <Text style={[styles.sleepHours, { color: sleep.quality_color }]}>
            {sleep.avg_hours}h
          </Text>
        )}
      </View>
      <Text style={styles.sleepTip}>{sleep.tip}</Text>
      {sleep.personal_tip && (
        <View style={styles.sleepPersonalTip}>
          <Ionicons name="bulb-outline" size={14} color="#f59e0b" />
          <Text style={styles.sleepPersonalTipText}>{sleep.personal_tip}</Text>
        </View>
      )}
      {sleep.has_data && (
        <Text style={styles.sleepDaysInfo}>
          📅 {sleep.days_with_data} dia{sleep.days_with_data !== 1 ? 's' : ''} com dados esta semana
        </Text>
      )}
    </View>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color }: { icon: string; value: string; label: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('Sincronizando dados...');
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async (showSyncAnimation = true) => {
    try {
      if (showSyncAnimation) {
        setSyncing(true);
        setSyncMessage('🔄 Sincronizando saúde com o Health Connect...');
      }

      // 1. Sincroniza dados de saúde ANTES de carregar o dashboard
      await executeSyncCycle('foreground');

      if (showSyncAnimation) {
        setSyncMessage('📊 Carregando seu dashboard...');
      }

      // 2. Busca dados completos do dashboard no backend
      const response = await api.get('/api/health-sync/dashboard');
      setDashboardData(response.data);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401) {
        // Token expirado — volta para login
        await SecureStore.deleteItemAsync('jwt_token');
        router.replace('/');
        return;
      }
      console.error('[Dashboard] Erro ao carregar:', error?.message);
    } finally {
      setSyncing(false);
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    registerAppStateSync();
    loadDashboard(true);
    return () => { unregisterAppStateSync(); };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard(false);
  }, []);

  const handleLogout = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair', style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('jwt_token');
          await SecureStore.deleteItemAsync('whatsapp_number');
          router.replace('/');
        },
      },
    ]);
  };

  // ─── Loading State ─────────────────────────────────────────────────────────
  if (loading || (syncing && !dashboardData)) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size={60} color="#39FF14" />
          <Text style={styles.loadingTitle}>Marcão AI</Text>
          <Text style={styles.loadingSubtitle}>{syncMessage}</Text>
          <View style={styles.loadingDots}>
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.loadingDot, { opacity: 0.3 + i * 0.25 }]} />
            ))}
          </View>
        </View>
      </View>
    );
  }

  const d = dashboardData;
  if (!d) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="cloud-offline-outline" size={64} color="#64748b" />
        <Text style={styles.errorText}>Não foi possível carregar o dashboard.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadDashboard(true)}>
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const p = d.profile;
  const w = d.weekly_stats;
  const isVocativo = (p.gender || 'M').toLowerCase().includes('f') ? 'Rainha' : 'Campeão';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#39FF14" />}
    >
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Marcão <Text style={styles.headerAI}>AI</Text></Text>
          <Text style={styles.headerSub}>Dashboard do Atleta</Text>
        </View>
        <View style={styles.headerRight}>
          {syncing && <ActivityIndicator size="small" color="#39FF14" style={{ marginRight: 10 }} />}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── HERO CARD ── */}
      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <View style={styles.heroTop}>
          <View style={styles.avatar}>
            {p.profile_picture_url ? (
              <Image source={{ uri: p.profile_picture_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarLetter}>{p.first_name[0]?.toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>Olá, {p.first_name}! {isVocativo}.</Text>
            <Text style={styles.heroSub}>
              Membro há {p.days_on_platform} dias · {p.member_since || '–'}
            </Text>
            <View style={styles.goalBadge}>
              <Text style={styles.goalBadgeText}>🎯 {p.goal} · {p.sport}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── SYNC STATUS ── */}
      {syncing && (
        <View style={styles.syncingBanner}>
          <ActivityIndicator size="small" color="#39FF14" />
          <Text style={styles.syncingText}>Sincronizando dados de saúde...</Text>
        </View>
      )}

      {/* ── STATS SEMANA ── */}
      <Text style={styles.sectionTitle}>📊 Esta Semana</Text>
      <View style={styles.statsGrid}>
        <StatCard icon="👟" value={w.steps.toLocaleString('pt-BR')} label="Passos" />
        <StatCard icon="🏋️" value={String(w.workouts)} label="Treinos" color="#6366f1" />
        <StatCard icon="🔥" value={w.calories.toLocaleString('pt-BR')} label="Kcal" />
        <StatCard icon="❤️" value={w.avg_hr > 0 ? `${w.avg_hr}` : '–'} label="FC Média" color="#ef4444" />
      </View>

      {/* ── STREAK ── */}
      <View style={styles.streakCard}>
        <View style={styles.streakTop}>
          <View>
            <Text style={styles.streakMeta}>SEQUÊNCIA DE TREINOS</Text>
            <Text style={styles.streakNumber}>{p.streak}</Text>
            <Text style={styles.streakDays}>dias seguidos</Text>
          </View>
          <View style={styles.streakRight}>
            <Text style={styles.streakIcon}>
              {p.streak >= 30 ? '🏅' : p.streak >= 14 ? '🔥' : p.streak >= 7 ? '⚡' : p.streak > 0 ? '📈' : '💤'}
            </Text>
            <Text style={styles.streakLabel}>{p.streak_label}</Text>
          </View>
        </View>
        <View style={styles.streakBarBg}>
          <View style={[styles.streakBarFill, { width: `${p.streak_pct}%` }]} />
        </View>
        <Text style={styles.streakSub}>{p.streak_pct}% do caminho para o streak lendário (30 dias) 🏅</Text>
      </View>

      {/* ── SONO (Card em Destaque) ── */}
      <Text style={styles.sectionTitle}>🛌 Análise de Sono</Text>
      <SleepCard sleep={d.sleep} />

      {/* ── PERFIL ── */}
      <Text style={styles.sectionTitle}>👤 Perfil do Atleta</Text>
      <View style={styles.profileGrid}>
        {[
          { label: 'Idade', value: p.age ? `${p.age} anos` : '–' },
          { label: 'Peso', value: p.weight ? `${p.weight} kg` : '–' },
          { label: 'Altura', value: p.height ? `${p.height} cm` : '–' },
          { label: 'IMC', value: p.imc ? String(p.imc) : '–' },
          { label: 'Categoria', value: p.imc_category || '–' },
          { label: 'Sono Médio', value: d.sleep.has_data ? `${d.sleep.avg_hours}h` : 'N/D' },
        ].map((item, i) => (
          <View key={i} style={styles.profileItem}>
            <Text style={styles.profileLabel}>{item.label}</Text>
            <Text style={styles.profileValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* ── HIDRATAÇÃO ── */}
      <View style={styles.hydrationCard}>
        <Text style={styles.hydrationIcon}>💧</Text>
        <View>
          <Text style={styles.hydrationTitle}>Meta de Hidratação: {p.hydration_ml.toLocaleString('pt-BR')}ml/dia</Text>
          <Text style={styles.hydrationSub}>Baseado no seu peso · {p.weight || 75}kg × 35ml</Text>
        </View>
      </View>

      {/* ── PRÓXIMA AVALIAÇÃO ── */}
      {p.next_photo_date && (
        <View style={styles.photoCard}>
          <View>
            <Text style={styles.photoTitle}>📸 Próxima Avaliação de Shape</Text>
            <Text style={styles.photoSub}>O Marcão compara suas fotos a cada 15 dias</Text>
          </View>
          <Text style={[
            styles.photoDate,
            p.next_photo_date.includes('⚠️') ? { color: '#ef4444' } : { color: '#f59e0b' }
          ]}>
            {p.next_photo_date}
          </Text>
        </View>
      )}

      {/* ── FOOTER ── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Acompanhamento personalizado por <Text style={{ color: '#6366f1' }}>Marcão AI</Text>
        </Text>
        <Text style={styles.footerSub}>Puxe para atualizar e sincronizar agora 🔄</Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628' },
  scrollContent: { padding: 20, paddingBottom: 60 },

  // Loading
  loadingContainer: {
    flex: 1, backgroundColor: '#0A1628',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  loadingCard: { alignItems: 'center', gap: 16 },
  loadingTitle: { fontSize: 28, fontWeight: '900', color: '#39FF14', marginTop: 8 },
  loadingSubtitle: { fontSize: 15, color: '#b0c4de', textAlign: 'center', maxWidth: 260 },
  loadingDots: { flexDirection: 'row', gap: 8, marginTop: 8 },
  loadingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#39FF14' },
  errorText: { fontSize: 16, color: '#94a3b8', textAlign: 'center', marginTop: 16 },
  retryButton: { marginTop: 20, backgroundColor: '#39FF14', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 },
  retryButtonText: { color: '#0A1628', fontWeight: '700', fontSize: 16 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerGreeting: { fontSize: 22, fontWeight: '900', color: '#fff' },
  headerAI: { color: '#6366f1' },
  headerSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  logoutBtn: { padding: 8 },

  // Hero Card
  heroCard: {
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)',
    borderRadius: 16, padding: 20, marginBottom: 20,
    overflow: 'hidden', position: 'relative',
  },
  heroGlow: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(99,102,241,0.15)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#6366f1',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarImg: { width: 60, height: 60, borderRadius: 30 },
  avatarLetter: { fontSize: 26, fontWeight: '900', color: '#fff' },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 },
  heroSub: { fontSize: 12, color: '#94a3b8' },
  goalBadge: {
    marginTop: 8, alignSelf: 'flex-start',
    backgroundColor: 'rgba(99,102,241,0.2)', borderWidth: 1, borderColor: '#6366f1',
    borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3,
  },
  goalBadgeText: { fontSize: 11, color: '#818cf8', fontWeight: '600' },

  // Syncing banner
  syncingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(57,255,20,0.08)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
  },
  syncingText: { color: '#39FF14', fontSize: 13 },

  // Section title
  sectionTitle: {
    fontSize: 11, fontWeight: '700', letterSpacing: 2,
    color: '#64748b', textTransform: 'uppercase', marginBottom: 12, marginTop: 8,
  },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    width: (width - 50) / 2,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16,
  },
  statIcon: { fontSize: 22, marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#f1f5f9', lineHeight: 26, marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '500' },

  // Streak
  streakCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, marginBottom: 20,
  },
  streakTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  streakMeta: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: '#64748b', marginBottom: 4 },
  streakNumber: { fontSize: 48, fontWeight: '900', color: '#f59e0b', lineHeight: 52 },
  streakDays: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  streakRight: { alignItems: 'flex-end' },
  streakIcon: { fontSize: 32 },
  streakLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: '#64748b', marginTop: 4 },
  streakBarBg: {
    width: '100%', height: 8, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 6,
  },
  streakBarFill: { height: 8, borderRadius: 99, backgroundColor: '#f59e0b' },
  streakSub: { fontSize: 12, color: '#64748b' },

  // Sleep card
  sleepCard: {
    borderWidth: 1, borderRadius: 16, padding: 18, marginBottom: 20,
  },
  sleepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  sleepEmoji: { fontSize: 32 },
  sleepHeaderText: { flex: 1 },
  sleepTitle: { fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 2 },
  sleepQualityLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  sleepHours: { fontSize: 28, fontWeight: '900' },
  sleepTip: { fontSize: 14, color: '#cbd5e1', lineHeight: 20, marginBottom: 10 },
  sleepPersonalTip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 8, padding: 10, marginBottom: 10,
  },
  sleepPersonalTipText: { flex: 1, fontSize: 13, color: '#fbbf24', lineHeight: 18 },
  sleepDaysInfo: { fontSize: 12, color: '#64748b' },

  // Profile grid
  profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  profileItem: {
    width: (width - 50) / 2,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 14,
  },
  profileLabel: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  profileValue: { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },

  // Hydration
  hydrationCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: 'rgba(6,182,212,0.08)', borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.2)', borderRadius: 16, padding: 18, marginBottom: 16,
  },
  hydrationIcon: { fontSize: 36 },
  hydrationTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  hydrationSub: { fontSize: 13, color: '#94a3b8' },

  // Photo card
  photoCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, marginBottom: 20,
  },
  photoTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 4 },
  photoSub: { fontSize: 12, color: '#64748b' },
  photoDate: { fontSize: 20, fontWeight: '800' },

  // Footer
  footer: { alignItems: 'center', paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  footerText: { fontSize: 12, color: '#64748b', textAlign: 'center' },
  footerSub: { fontSize: 11, color: '#475569', marginTop: 6 },
});
