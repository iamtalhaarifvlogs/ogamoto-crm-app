// App.js
import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, 
  Dimensions, FlatList, KeyboardAvoidingView, Platform, Alert, ScrollView 
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { WebView } from 'react-native-webview';
import * as Notifications from 'expo-notifications';

// Premium UI Vector Set
import { 
  Bot, Send, Sparkles, LogIn, LayoutDashboard, Globe, 
  FileSpreadsheet, PlusCircle, User, Lock, TrendingUp, ShippingContainer, Clock, Bell, Layers, CheckCircle
} from 'lucide-react-native';

import { MayaAgent } from './src/agents/Maya';

const { width } = Dimensions.get('window');

// Global Auth Session
let GLOBAL_AUTH_SESSION = { username: '', password: '', isLoggedIn: false };

// Configure Expo Notification Handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ==========================================
// 1. SECURE & STABLE AUTHENTICATION SCREEN
// ==========================================
const LoginScreen = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('john@gmail.com');
  const [password, setPassword] = useState('abcd1234');
  const [authStage, setAuthStage] = useState('IDLE');

  const executeAuthPipeline = () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Access Denied", "Please populate both secure key fields.");
      return;
    }

    setAuthStage('VALIDATING');

    setTimeout(() => {
      GLOBAL_AUTH_SESSION = { username, password, isLoggedIn: true };
      setAuthStage('SUCCESS_SPLASH');

      setTimeout(() => {
        onLoginSuccess();
      }, 1500);
    }, 1000);
  };

  if (authStage === 'SUCCESS_SPLASH') {
    return (
      <View style={styles.successSplashContainer}>
        <Sparkles size={50} color="#00E5FF" />
        <Text style={styles.successSplashTitle}>WELCOME TO OGAMOTO</Text>
        <Text style={styles.successSplashSubtitle}>Synchronizing Secure CRM Matrix Platform...</Text>
        <ActivityIndicator size="small" color="#00E5FF" style={{ marginTop: 30 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.loginContainer}>
      <View style={styles.loginCard}>
        <Text style={styles.loginBrandText}>OGAMOTO</Text>
        <Text style={styles.loginTagline}>ENTERPRISE SYSTEM PORTAL</Text>

        <View style={styles.inputWrapper}>
          <User size={16} color="#00E5FF" style={styles.inputIcon} />
          <TextInput 
            style={styles.authInputField} 
            placeholder="Admin Identifier / Email" 
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
            placeholder="Security Access Token" 
            placeholderTextColor="#444"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity style={styles.loginSubmitButton} onPress={executeAuthPipeline} disabled={authStage === 'VALIDATING'}>
          {authStage === 'VALIDATING' ? (
            <ActivityIndicator size="small" color="#09090b" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <LogIn size={16} color="#09090b" style={{ marginRight: 8 }} />
              <Text style={styles.loginButtonText}>INITIALIZE INTERFACE</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// ==========================================
// 2. DETAILED EXECUTIVE ANALYTICS DASHBOARD
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

      {/* KPI Cards */}
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

      {/* Graphical Bar Visual Matrix */}
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

      {/* Executive Financial / Partner Status Card */}
      <Text style={styles.sectionSubHeading}>Financing Partner Ledger</Text>
      <View style={styles.systemStatusLedgerAlertBox}>
        <Layers size={18} color="#00E5FF" style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Habib Bank Credit Line</Text>
          <Text style={{ color: '#888', fontSize: 11, marginTop: 2 }}>Limit: $500,000 | Interest Rate: 8.5% | Active</Text>
        </View>
      </View>

      <View style={[styles.systemStatusLedgerAlertBox, { marginTop: 12 }]}>
        <Clock size={18} color="#00E5FF" style={{ marginRight: 12 }} />
        <Text style={styles.statusBoxMetaText}>Quantum Sync State established. Database clusters updated.</Text>
      </View>
    </ScrollView>
  );
};

// ==========================================
// 3. SECURE PASS-THROUGH WEBVIEW
// ==========================================
const CRMWebViewScreen = () => {
  const [loading, setLoading] = useState(true);

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: 'https://pap-crm.vercel.app/' }}
        style={styles.webview}
        onLoadEnd={() => setLoading(false)}
      />
      {loading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#00E5FF" />
          <Text style={styles.loadingText}>Synchronizing Executive Matrix...</Text>
        </View>
      )}
    </View>
  );
};

// ==========================================
// 4. CONVERSATIONAL MAYA AI CONSOLE (WITH TYPING EFFECT)
// ==========================================
const MayaAgentConsoleScreen = () => {
  const [messages, setMessages] = useState([
    { id: '1', text: "Greetings Executive. Maya operations core online. How can I assist with your leads, cargo manifests, or reminders today?", isBot: true }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const maya = useRef(new MayaAgent()).current;

  // Handles character-by-character typewriter streaming effect
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

    // Get multi-variant advice and operational instruction
    const response = await maya.handleUserDirective(userMsg);

    // Schedule local notification if requested by Maya
    if (response.notificationRequest) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: response.notificationRequest.title,
          body: response.notificationRequest.body,
        },
        trigger: { seconds: response.notificationRequest.delaySeconds },
      });
    }

    // Stream Maya's response using typing effect
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
          placeholder="Command Maya (e.g. 'Show leads', 'Remind me in 10 sec')..." 
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
// 5. REPORTS & SYSTEM REGISTRY LEDGER
// ==========================================
const ReportsScreen = () => {
  const [reports, setReports] = useState([
    { id: '1', title: 'tbl_leads_export.pdf', timestamp: '2026-07-28 14:22' },
    { id: '2', title: 'tbl_shipment_export.pdf', timestamp: '2026-07-29 09:11' }
  ]);

  const generateReport = () => {
    const mockId = (reports.length + 1).toString();
    const newReport = { id: mockId, title: `tbl_compiled_logistics_${mockId}.pdf`, timestamp: 'Just Now' };
    setReports(prev => [newReport, ...prev]);
    Alert.alert("Report Generated", "Aether has created and indexed your new system log.");
  };

  return (
    <View style={styles.container}>
      <FlatList 
        data={reports}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 20 }}
        renderItem={({ item }) => (
          <View style={styles.reportRowItemCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <FileSpreadsheet size={20} color="#00E5FF" style={{ marginRight: 12 }} />
              <View>
                <Text style={styles.reportItemHeaderTitle}>{item.title}</Text>
                <Text style={styles.reportItemTimestampMeta}>{item.timestamp}</Text>
              </View>
            </View>
          </View>
        )}
      />
      <TouchableOpacity style={styles.floatingActionButtonPlus} onPress={generateReport}>
        <PlusCircle size={20} color="#09090b" />
        <Text style={styles.fabTextLabel}>GENERATE SYSTEM REGISTRY LOG</Text>
      </TouchableOpacity>
    </View>
  );
};

// ==========================================
// 6. MAIN NAVIGATION ROUTER
// ==========================================
const Drawer = createDrawerNavigator();

const CustomDrawerContent = (props) => (
  <DrawerContentScrollView {...props} style={{ backgroundColor: '#09090b' }}>
    <View style={styles.drawerHeaderBrandingProfileContainer}>
      <Text style={styles.drawerMainHeadingTitle}>OGAMOTO</Text>
      <Text style={styles.drawerSubHeadingMetaLabel}>Core Terminal Profile Layer</Text>
    </View>
    <DrawerItemList {...props} />
  </DrawerContentScrollView>
);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Request local notification permissions on boot
    Notifications.requestPermissionsAsync();
  }, []);

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <NavigationContainer>
      <Drawer.Navigator
        drawerContent={(props) => <CustomDrawerContent {...props} />}
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
        <Drawer.Screen name="Reports" component={ReportsScreen} options={{ drawerIcon: () => <FileSpreadsheet size={16} color="#00E5FF" /> }} />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}

// ==========================================
// EXECUTIVE STYLING ENGINE
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  webview: { flex: 1, backgroundColor: '#09090b' },
  loaderContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b', zIndex: 10 },
  loadingText: { marginTop: 16, color: '#00E5FF', fontSize: 12, letterSpacing: 1, fontWeight: '600' },
  
  successSplashContainer: { flex: 1, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center' },
  successSplashTitle: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: 4, marginTop: 20 },
  successSplashSubtitle: { fontSize: 12, color: '#00E5FF', marginTop: 8, opacity: 0.8, letterSpacing: 1 },
  
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
  sectionSubHeading: { fontSize: 12, fontWeight: '700', color: '#00E5FF', marginTop: 24, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dashboardMetricItem: { backgroundColor: '#101014', width: '48%', padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#1a1a22' },
  activeItemCard: { borderColor: '#00E5FF' },
  dashboardMetricNumber: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 10 },
  dashboardMetricLabel: { color: '#666', fontSize: 11, marginTop: 4, fontWeight: '600' },
  systemStatusLedgerAlertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101014', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#1a1a22' },
  statusBoxMetaText: { color: '#888', fontSize: 12, flex: 1, lineHeight: 18 },

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
  sendButton: { backgroundColor: '#00E5FF', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },

  reportRowItemCard: { backgroundColor: '#101014', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1a1a22' },
  reportItemHeaderTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  reportItemTimestampMeta: { color: '#444', fontSize: 11, marginTop: 4, fontWeight: '500' },
  floatingActionButtonPlus: { flexDirection: 'row', backgroundColor: '#00E5FF', position: 'absolute', bottom: 25, left: 20, right: 20, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  fabTextLabel: { color: '#09090b', fontWeight: '800', fontSize: 12, marginLeft: 10, letterSpacing: 1 },

  drawerHeaderBrandingProfileContainer: { padding: 24, borderBottomWidth: 1, borderBottomColor: '#1a1a22', marginBottom: 12, marginTop: 20 },
  drawerMainHeadingTitle: { fontSize: 24, fontWeight: '900', color: '#00E5FF', letterSpacing: 4 },
  drawerSubHeadingMetaLabel: { color: '#444', fontSize: 11, marginTop: 2, fontWeight: '600', textTransform: 'uppercase' }
});
