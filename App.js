// App.js
import 'react-native-gesture-handler';
import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  Dimensions, FlatList, KeyboardAvoidingView, Platform, Alert, ScrollView 
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { WebView } from 'react-native-webview';

// Vectors
import { 
  Bot, Send, Sparkles, LogIn, LayoutDashboard, Globe, 
  FileSpreadsheet, PlusCircle, User, Lock, TrendingUp, ShippingContainer, Clock, Layers
} from 'lucide-react-native';

import { MayaAgent } from './src/agents/Maya';

const { width } = Dimensions.get('window');

// ==========================================
// 1. SAFE STABLE LOGIN SCREEN
// ==========================================
const LoginScreen = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('john@gmail.com');
  const [password, setPassword] = useState('abcd1234');

  const handleLogin = () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    // Direct, synchronous state lift prevents unmounted memory leaks & crashes
    onLoginSuccess();
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

        <TouchableOpacity style={styles.loginSubmitButton} onPress={handleLogin}>
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
// 2. DASHBOARD SCREEN
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

      <Text style={styles.sectionSubHeading}>Analytical Performance ({activeChartFilter})</Text>
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
    </ScrollView>
  );
};

// ==========================================
// 3. WEBVIEW SCREEN
// ==========================================
const CRMWebViewScreen = () => (
  <View style={styles.container}>
    <WebView source={{ uri: 'https://pap-crm.vercel.app/' }} style={styles.webview} />
  </View>
);

// ==========================================
// 4. MAYA AI SCREEN
// ==========================================
const MayaAgentConsoleScreen = () => {
  const [messages, setMessages] = useState([
    { id: '1', text: "Greetings Executive. Maya operations core online.", isBot: true }
  ]);
  const [inputText, setInputText] = useState('');
  const maya = useRef(new MayaAgent()).current;

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMsg = inputText;
    setMessages(prev => [...prev, { id: Date.now().toString(), text: userMsg, isBot: false }]);
    setInputText('');

    const response = await maya.handleUserDirective(userMsg);
    setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: response.advice, isBot: true }]);
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
      <View style={styles.inputContainer}>
        <TextInput 
          style={styles.chatInput} 
          placeholder="Command Maya..." 
          placeholderTextColor="#444" 
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Send size={14} color="#09090b" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// ==========================================
// 5. DRAWER NAVIGATOR
// ==========================================
const Drawer = createDrawerNavigator();

function MainAppDrawer() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#09090b', borderBottomWidth: 1, borderBottomColor: '#1a1a22' },
        headerTintColor: '#00E5FF',
        drawerStyle: { backgroundColor: '#09090b' },
        drawerLabelStyle: { color: '#fff' },
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
// 6. MAIN ROOT APP
// ==========================================
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <NavigationContainer>
      {isLoggedIn ? (
        <MainAppDrawer />
      ) : (
        <LoginScreen onLoginSuccess={() => setIsLoggedIn(true)} />
      )}
    </NavigationContainer>
  );
}

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
  graphContainerCanvas: { backgroundColor: '#101014', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#1a1a22', height: 230, justifyContent: 'flex-end' },
  graphBarsAxisContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', width: '100%' },
  individualBarColumn: { alignItems: 'center' },
  interactiveChartBarLine: { width: 34, backgroundColor: '#00E5FF', borderRadius: 6 },
  barMarkerLabels: { color: '#555', fontSize: 10, marginTop: 10, fontWeight: '700' },
  barMarkerValueText: { color: '#fff', fontSize: 10, marginBottom: 6, fontWeight: '600' },
  msgBubble: { padding: 14, borderRadius: 18, marginVertical: 6, maxWidth: '85%' },
  botBubble: { backgroundColor: '#101014', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#1a1a22' },
  userBubble: { backgroundColor: '#00E5FF', alignSelf: 'end' },
  msgText: { color: '#fff', fontSize: 13, lineHeight: 19 },
  inputContainer: { flexDirection: 'row', padding: 16, backgroundColor: '#09090b', borderTopWidth: 1, borderTopColor: '#1a1a22', alignItems: 'center' },
  chatInput: { flex: 1, backgroundColor: '#101014', color: '#fff', paddingHorizontal: 18, height: 48, borderRadius: 24, marginRight: 12, borderWidth: 1, borderColor: '#1a1a22' },
  sendButton: { backgroundColor: '#00E5FF', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }
});
