import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

export default function LoginScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log("Verificando sessão persistente...");
        const token = await SecureStore.getItemAsync('jwt_token');
        
        if (token) {
          console.log("Token encontrado, redirecionando para Home.");
          router.replace('/home');
        } else {
          console.log("Nenhum token encontrado, permanecendo no Login.");
        }
      } catch (error) {
        // Se houver qualquer erro no SecureStore ou no roteamento, garantimos que o app não trave
        console.error("ERRO CRÍTICO na leitura do SecureStore:", error);
        // Em caso de erro, garantimos que o estado checkingSession mude para permitir que o usuário faça login novamente
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const handleRequestOTP = async () => {
    if (!phoneNumber) {
      Alert.alert('Erro', 'Por favor, insira o número do WhatsApp.');
      return;
    }
    
    let cleanedPhone = phoneNumber.replace(/\D/g, '');
    if (cleanedPhone.length === 10 || cleanedPhone.length === 11) {
      cleanedPhone = `55${cleanedPhone}`;
    }
    
    setLoading(true);
    try {
      await api.post('https://api.marcaopersonal.com/api/auth/request-otp', {
        phone: cleanedPhone,
      });
      router.push({ pathname: '/otp', params: { phoneNumber } });
    } catch (error: any) {
      console.error("ERRO COMPLETO AO SOLICITAR OTP:");
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
      Alert.alert('Erro', 'Não foi possível solicitar o código. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#39FF14" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Marcão Sync</Text>
      <Text style={styles.subtitle}>Digite seu WhatsApp para iniciar</Text>
      
      <TextInput
        style={styles.input}
        placeholder="(11) 99999-9999"
        placeholderTextColor="#4b6b8c"
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
      />
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleRequestOTP} 
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#0A1628" />
        ) : (
          <Text style={styles.buttonText}>Receber Código</Text>
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
    fontSize: 40,
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
    fontSize: 24,
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
