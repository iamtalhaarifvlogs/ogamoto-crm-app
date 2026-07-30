// App.js
import 'react-native-gesture-handler';
import React, { useState, useRef } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  Dimensions, FlatList, KeyboardAvoidingView, Platform, Alert, ScrollView 
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { WebView } from 'react-native-webview';

// Icons
import { 
  Bot, Send, LogIn, LayoutDashboard, Globe, 
  FileSpreadsheet, PlusCircle, User, Lock, TrendingUp, ShippingContainer, Clock, Layers
} from 'lucide-react-native';

import { MayaAgent } from './src/agents/Maya';

const { width } = Dimensions.get('window');
const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

// ==========================================
// 1. STABLE LOGIN SCREEN
// ==========================================
const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('john@gmail.com');
  const [password, setPassword] = useState('abcd1234');

  const handleLogin = () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Authentication Failed", "Please enter valid credentials.");
      return;
    }
    // Safely navigate to MainApp via Stack Router without unmounting state errors
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainApp' }],
    });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.loginContainer}>
      <View style={styles.loginCard}>
        <Text style={styles.loginBrandText}>OGAMOTO</Text>
        <Text style={styles.loginTagline}>ENTERPRISE SYSTEM PORTAL</Text>

        <View style={styles.inputWrapper}>
          <User size={16} color="#00E5FF" style={styles.inputIcon} />
          <TextInput 
            style={styles.authInputField} 
            placeholder="Admin Email" 
            placeholderTextColor="#444"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputWrapper}>
          <Lock size={16} color="#00E5FF" style={styles.inputIcon} />
          <TextInput 
            style={styles.authInputField} 
            placeholder="Password" 
            placeholderTextColor="#444"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity style={styles.loginSubmitButton} onPress={handleLogin} activeOpacity={0.8}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <LogIn size={16} color="#09090b" style={{ marginRight: 8 }} />
            <Text style={styles.loginButtonText}>INITIALIZE INTERFACE</Text>
          </View>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// ==========================================
// 2. EXECUTIVE DASHBOARD SCREEN
// ==========================================
const DashboardScreen = () => {
  const [activeChartFilter, setActiveChartFilter] = useState('LEADS');
  
  const analytics = {
    LEADS: [
      { label: 'Q1 Target', value: '$450K', height: 80 },
      { label: 'Q2 Pipeline', value: '$820K', height: 130 },
      { label: 'Q3 Forecast', value: '$1.2M', height: 170 },
      { label: 'Q4 Closed', value: '$610K', height: 100 }
    ],
    SHIPMENTS: [
      { label: 'Container', value: '120 Units', height: 60 },
      { label: 'Bulk Vessel', value: '310 Units', height: 150 },
      { label: 'Air Freight', value: '95 Units', height: 50 },
      { label: 'Customs', value: '240 Units', height: 110 }
    ]
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.sectionHeading}>Executive Command Stack</Text>

      <View style={styles.statsRow}>
        <TouchableOpacity style={[styles.dashboardMetricItem, activeChartFilter === 'LEADS' && styles.activeItemCard]} onPress={() => setActiveChartFilter('LEADS')}>
          <TrendingUp size={18} color={activeChartFilter === 'LEADS' ? '#00E5FF' : '#555'} />
          <Text style={styles.dashboardMetricNumber}>$1.25M</Text>
          <Text style={styles.dashboardMetricLabel}>Active Lead Valuation</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.dashboardMetricItem, activeChartFilter === 'SHIPMENTS' && styles.activeItemCard]} onPress={() => setActiveChartFilter('SHIPMENTS')}>
          <ShippingContainer size={18} color={activeChartFilter === 'SHIPMENTS' ? '#00E5FF' : '#555'} />
          <Text style={styles.dashboardMetricNumber}>765</Text>
          <Text style={styles.dashboardMetricLabel}>Sea Cargo Manifests</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionSubHeading}>Analytical Performance Vector ({activeChartFilter})</Text>
      <View style={styles.graphContainerCanvas}>
        <View style={styles.graphBarsAxisContainer}>
          {analytics[activeChartFilter].map((item, index) => (
            <View key={index} style={styles.individualBarColumn}>
              <Text style={styles.barMarkerValueText}>{item.value}</Text>
              <View style={[styles.interactiveChartBarLine, { height: item.height }]} />
              <Text style={styles.barMarkerLabels}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.sectionSubHeading}>Financing Partner Ledger</Text>
      <View style={styles.systemStatusLedgerAlertBox}>
        <Layers size={18} color="#00E5FF" style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Habib Bank Credit Line</Text>
          <Text style={{ color: '#888', fontSize: 11, marginTop: 2 }}>Limit: $500,000 | Interest Rate: 8.5% | Active</Text>
        </View>
      </View>
    </ScrollView>
  );
};

// ==========================================
// 3. WEBVIEW PORTAL
// ==========================================
const CRMWebViewScreen = () => (
  <View style={styles.container}>
    <WebView source={{ uri: 'https://pap-crm.vercel.app/' }} style={styles.webview} />
  </View>
);

// ==========================================
// 4. MAYA CONSOLE WITH TYPING EFFECT
// ==========================================
const MayaAgentConsoleScreen = () => {
  const [messages, setMessages] = useState([
    { id: '1', text: "Greetings Executive. Maya operations core online. How can I assist with your leads, cargo manifests, or reminders today?", isBot: true }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const maya = useRef(new MayaAgent()).current;

  const simulateTypingResponse = (fullText) => {
    let currentLength = 0;
    const messageId = Date.now().toString();

    setMessages(prev => [...prev, { id: messageId, text: '', isBot: true }]);

    const interval = setInterval(() => {
      currentLength += 3;
      const nextChunk = fullText.slice(0, currentLength);

      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: nextChunk } : m));

      if (currentLength >= fullText.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 20);
  };

  const handleSend = async () => {
    if (!inputText.trim() || isTyping) return;

    const userMsg = inputText;
    setMessages(prev => [...prev, { id: Date.now().toString(), text: userMsg, isBot: false }]);
    setInputText('');
    setIsTyping(true);

    const response = await maya.handleUserDirective(userMsg);
    simulateTypingResponse(response.advice);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90} style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 20 }}
        renderItem={({ item }) => (
          <View style={[styles.msgBubble, item.isBot ? styles.botBubble : styles.userBubble]}>
            <Text style={styles.msgText}>{item.text}</Text>
          </View>
        )}
      />
      {isTyping && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
          <Bot size={14} color="#00E5FF" style={{ marginRight: 6 }} />
          <Text style={{ color: '#00E5FF', fontSize: 11 }}>Maya is formulating advice...</Text>
        </View>
      )}
      <View style={styles.inputContainer}>
        <TextInput 
          style={styles.chatInput} 
          placeholder="Command Maya..." 
          placeholderTextColor="#444" 
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={isTyping}>
          <Send size={14} color="#09090b" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// ==========================================
// 5. DRAWER NAVIGATOR
// ==========================================
function DrawerNavigator() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#09090b', borderBottomWidth: 1, borderBottomColor: '#1a1a22' },
        headerTintColor: '#00E5FF',
        drawerStyle: { backgroundColor: '#09090b' },
        drawerLabelStyle: { color: '#fff', fontWeight: '600' },
        drawerActiveTintColor: '#00E5FF',
        drawerActiveBackgroundColor: '#101014'
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} options={{ drawerIcon: () => <LayoutDashboard size={16} color="#00E5FF" /> }} />
      <Drawer.Screen name="Maya AI" component={MayaAgentConsoleScreen} options={{ drawerIcon: () => <Bot size={16} color="#00E5FF" /> }} />
      <Drawer.Screen name="CRM Portal" component={CRMWebViewScreen} options={{ drawerIcon: () => <Globe size={16} color="#00E5FF" /> }} />
    </Drawer.Navigator>
  );
}

// ==========================================
// 6. ROOT APP ENTRY WITH GESTURE WRAPPER
// ==========================================
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="MainApp" component={DrawerNavigator} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

// ==========================================
// STYLES
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  webview: { flex: 1, backgroundColor: '#09090b' },
  loginContainer: { flex: 1, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center' },
  loginCard: { width: width * 0.85, padding: 28, backgroundColor: '#101014', borderRadius: 24, borderWidth: 1, borderColor: '#1a1a22' },
  loginBrandText: { fontSize: 32, fontWeight: '900', color: '#00E5FF', textAlign: 'center', letterSpacing: 6 },
  loginTagline: { fontSize: 10, color: '#fff', opacity: 0.4, textAlign: 'center', letterSpacing: 2, marginBottom: 35, marginTop: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#09090b', borderWidth: 1, borderColor: '#1a1a22', borderRadius: 14, marginBottom: 16, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  authInputField: { flex: 1, height: 50, color: '#fff', fontSize: 14 },
  loginSubmitButton: { backgroundColor: '#00E5FF', height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  loginButtonText: { color: '#09090b', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  sectionHeading: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 20 },
  sectionSubHeading: { fontSize: 12, fontWeight: '700', color: '#00E5FF', marginTop: 24, marginBottom: 16, letterSpacing: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dashboardMetricItem: { backgroundColor: '#101014', width: '48%', padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#1a1a22' },
  activeItemCard: { borderColor: '#00E5FF' },
  dashboardMetricNumber: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 10 },
  dashboardMetricLabel: { color: '#666', fontSize: 11, marginTop: 4, fontWeight: '600' },
  systemStatusLedgerAlertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101014', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#1a1a22', marginTop: 12 },
  graphContainerCanvas: { backgroundColor: '#101014', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#1a1a22', height: 230, justifyContent: 'flex-end' },
  graphBarsAxisContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', width: '100%' },
  individualBarColumn: { alignItems: 'center' },
  interactiveChartBarLine: { width: 34, backgroundColor: '#00E5FF', borderRadius: 6 },
  barMarkerLabels: { color: '#555', fontSize: 10, marginTop: 10, fontWeight: '700' },
  barMarkerValueText: { color: '#fff', fontSize: 10, marginBottom: 6, fontWeight: '600' },
  msgBubble: { padding: 14, borderRadius: 18, marginVertical: 6, maxWidth: '85%' },
  botBubble: { backgroundColor: '#101014', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#1a1a22' },
  userBubble: { backgroundColor: '#00E5FF', alignSelf: 'flex-end' },
  msgText: { color: '#fff', fontSize: 13, lineHeight: 19 },
  inputContainer: { flexDirection: 'row', padding: 16, backgroundColor: '#09090b', borderTopWidth: 1, borderTopColor: '#1a1a22', alignItems: 'center' },
  chatInput: { flex: 1, backgroundColor: '#101014', color: '#fff', paddingHorizontal: 18, height: 48, borderRadius: 24, marginRight: 12, borderWidth: 1, borderColor: '#1a1a22' },
  sendButton: { backgroundColor: '#00E5FF', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }
});
