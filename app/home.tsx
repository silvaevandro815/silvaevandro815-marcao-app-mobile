import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { HealthService } from '../services/HealthService';

export default function HomeScreen() {
  const router = useRouter();

  useEffect(() => {
    HealthService.requestHealthPermissions();
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sair', 
          style: 'destructive',
          onPress: async () => {
            try {
              await SecureStore.deleteItemAsync('jwt_token');
              await SecureStore.deleteItemAsync('whatsapp_number');
              router.replace('/');
            } catch (error) {
              console.error("Erro ao fazer logout:", error);
              Alert.alert('Erro', 'Não foi possível sair.');
            }
          }
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="checkmark-circle" size={150} color="#39FF14" />
      </View>
      <Text style={styles.title}>Marcão Conectado.</Text>
      <Text style={styles.description}>
        O monitoramento de saúde está ativo em segundo plano. Pode fechar o app e ir treinar!
      </Text>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#ff4b4b" />
        <Text style={styles.logoutText}>Sair da Conta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconContainer: {
    marginBottom: 40,
    shadowColor: "#39FF14",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#39FF14',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 48,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    padding: 12,
  },
  logoutText: {
    color: '#ff4b4b',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
