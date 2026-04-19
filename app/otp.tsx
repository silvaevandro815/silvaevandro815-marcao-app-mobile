import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

export default function OTPScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { phoneNumber } = useLocalSearchParams();

  const handleVerifyOTP = async () => {
    if (code.length < 6) {
      Alert.alert('Erro', 'Por favor, insira o código de 6 dígitos.');
      return;
    }

    let cleanedPhone = String(phoneNumber).replace(/\D/g, '');
    if (cleanedPhone.length === 10 || cleanedPhone.length === 11) {
      cleanedPhone = `55${cleanedPhone}`;
    }

    setLoading(true);
    try {
      const response = await api.post('https://api.marcaopersonal.com/api/auth/verify-otp', {
        phone: cleanedPhone,
        code: code,
      });

      const { data } = response;
      if (data && data.access_token) {
        await SecureStore.setItemAsync('jwt_token', data.access_token);
        await SecureStore.setItemAsync('whatsapp_number', cleanedPhone);
        
        router.replace('/home');
      } else {
        throw new Error('Token não recebido');
      }
    } catch (error: any) {
      console.error("ERRO COMPLETO AO VERIFICAR OTP:");
      if (error.response) {
        console.error("Data:", error.response.data);
        console.error("Status:", error.response.status);
        console.error("Headers:", error.response.headers);
      } else if (error.request) {
        console.error("Request object:", error.request);
      } else {
        console.error("Error message:", error.message);
      }
      console.error("Error config:", error.config);
      Alert.alert('Erro', 'Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verificação</Text>
      <Text style={styles.subtitle}>Insira o código enviado para {phoneNumber}</Text>
      
      <TextInput
        style={styles.input}
        placeholder="------"
        placeholderTextColor="#4b6b8c"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
      />
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleVerifyOTP} 
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#0A1628" />
        ) : (
          <Text style={styles.buttonText}>Confirmar Código</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#39FF14',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 48,
  },
  input: {
    backgroundColor: '#122543',
    color: '#39FF14',
    fontSize: 36,
    letterSpacing: 8,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#39FF14',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#39FF14',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#0A1628',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
