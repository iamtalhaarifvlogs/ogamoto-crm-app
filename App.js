import 'react-native-gesture-handler';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Dimensions, FlatList, KeyboardAvoidingView, Platform, Alert, ScrollView, SafeAreaView, ActivityIndicator
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { WebView } from 'react-native-webview';

// Expo Modules for Notifications & PDF Generation
import * as Notifications from 'expo-notifications';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Vector Icons
import {
  Bot, Send, LogIn, LayoutDashboard, Globe,
  User, Lock, TrendingUp, Container, Layers, LogOut, Eye, EyeOff,
  Menu, FileText, Download, Anchor, Truck, Sliders, Settings, Plus, RefreshCw, Bell
} from 'lucide-react-native';

// Notification Handler Setup
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const { width } = Dimensions.get('window');
const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

// ==========================================
// CENTRALIZED REAL-TIME DATA STORE
// ==========================================
export const GlobalDataStore = {
  leads: [
    { id: '1', name: 'Jayson Tatum', vehicle: 'Honda Civic', deposit: 22000, date: '2026-07-28', status: 'Active' },
    { id: '2', name: 'Samba Motors', vehicle: 'Toyota HiAce', deposit: 15000, date: '2026-07-29', status: 'Pipeline' },
    { id: '3', name: 'Karachi Logistics', vehicle: 'Isuzu Truck', deposit: 45000, date: '2026-07-30', status: 'Closed' },
  ],
  shipments: [
    { id: 'S1', container: 'CN-9082', vessel: 'Evergreen Alpha', origin: 'Port Qasim', units: 120, status: 'In Transit' },
    { id: 'S2', container: 'CN-4410', vessel: 'Maersk Sealand', origin: 'KPT Terminal', units: 310, status: 'Customs' },
  ],
  reports: [
    { id: 'REP-001', title: 'Q2 Executive Lead Audit', date: '2026-07-15', size: '1.2 MB' },
    { id: 'REP-002', title: 'Cargo & Logistics Manifest', date: '2026-07-28', size: '850 KB' },
  ],
  addLead(leadData) {
    const newLead = {
      id: Date.now().toString(),
      name: leadData.name || 'Unassigned Lead',
      vehicle: leadData.vehicle || 'Standard Unit',
      deposit: Number(leadData.deposit) || 0,
      date: new Date().toISOString().split('T')[0],
      status: 'Active'
    };
    this.leads.unshift(newLead);
    return newLead;
  }
};

// ==========================================
// MAYA & AETHER AI ENGINE (WITH PUSH NOTIFICATIONS)
// ==========================================
class OperationalMayaEngine {
  async requestNotificationPermission() {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  async scheduleNotification(seconds, title, body) {
    const hasPermission = await this.requestNotificationPermission();
    if (!hasPermission) {
      return 'Notification permission missing. Please enable alerts in app settings.';
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: title || 'OGAMOTO Alert', body: body || 'Scheduled Maya action.' },
      trigger: { seconds: seconds },
    });
    return `Notification set! Triggering in ${seconds} seconds.`;
  }

  async parseAndExecute(input) {
    const lower = input.toLowerCase();

    // 1. Handle Reminders / Notifications
    if (lower.includes('notify') || lower.includes('remind')) {
      let delaySeconds = 60;
      const minuteMatch = lower.match(/in\s+(\d+)\s+min/);
      if (minuteMatch) {
        delaySeconds = parseInt(minuteMatch[1]) * 60;
      }
      return await this.scheduleNotification(delaySeconds, 'Maya Reminder', `Action prompt: "${input}"`);
    }

    // 2. Handle Lead Display Queries
    if (lower.includes('show lead') || lower.includes('list lead') || lower.includes('get lead')) {
      const leadsList = GlobalDataStore.leads.map(l => `• ${l.name} - ${l.vehicle} ($${l.deposit.toLocaleString()})`).join('\n');
      return `**Current Pipeline Leads:**\n\n${leadsList}`;
    }

    // 3. Handle Add Lead Directives (CUD)
    if (lower.includes('add') && lower.includes('lead')) {
      // Natural language parsing for attributes
      const depositMatch = input.match(/\$(\d+)/) || input.match(/of\s+(\d+)/);
      const depositVal = depositMatch ? depositMatch[1] : 0;
      
      let nameVal = 'New Lead';
      if (lower.includes('add ')) {
        const afterAdd = input.split(/add/i)[1];
        const asMatch = afterAdd.split(/as a|for/i)[0];
        if (asMatch && asMatch.trim()) nameVal = asMatch.trim();
      }

      let vehicleVal = 'Vehicle Unit';
      if (lower.includes('for ')) {
        const afterFor = input.split(/for/i)[1];
        const withMatch = afterFor.split(/with|\$/i)[0];
        if (withMatch && withMatch.trim()) vehicleVal = withMatch.trim();
      }

      const created = GlobalDataStore.addLead({ name: nameVal, vehicle: vehicleVal, deposit: depositVal });

      return `**Aether Execution Update:**\nStatus: SUCCESS\nEntity: LEADS\nAction: CREATE\n\nRecorded Lead: ${created.name}\nVehicle: ${created.vehicle}\nDeposit: $${created.deposit.toLocaleString()}`;
    }

    return "Executive directive logged. Aether state synchronized.";
  }
}

// ==========================================
// 1. LOGIN SCREEN
// ==========================================
const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('john@gmail.com');
  const [password, setPassword] = useState('abcd1234');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Authentication Error', 'Please enter valid credentials.');
      return;
    }
    setIsLoggingIn(true);
    requestAnimationFrame(() => {
      navigation.reset({ index: 0, routes: [{ name: 'MainDrawer' }] });
    });
  };

  return (
    <SafeAreaView style={styles.loginContainer}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
        <View style={styles.loginGlow} />
        <View style={styles.loginCard}>
          <View style={styles.brandBadge}><Bot size={26} color="#00E5FF" /></View>
          <Text style={styles.loginBrandText}>OGAMOTO</Text>
          <Text style={styles.loginTagline}>ENTERPRISE SYSTEM PORTAL</Text>

          <View style={styles.inputWrapper}>
            <User size={16} color="#00E5FF" style={styles.inputIcon} />
            <TextInput style={styles.authInputField} placeholder="Admin Identifier" placeholderTextColor="#4a4a55" value={username} onChangeText={setUsername} autoCapitalize="none" />
          </View>

          <View style={styles.inputWrapper}>
            <Lock size={16} color="#00E5FF" style={styles.inputIcon} />
            <TextInput style={styles.authInputField} placeholder="Access Key" placeholderTextColor="#4a4a55" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} autoCapitalize="none" />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)}>
              {showPassword ? <EyeOff size={16} color="#555" /> : <Eye size={16} color="#555" />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.loginSubmitButton, isLoggingIn && styles.loginSubmitButtonDisabled]} onPress={handleLogin} disabled={isLoggingIn} activeOpacity={0.85}>
            {isLoggingIn ? <ActivityIndicator color="#09090b" /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <LogIn size={16} color="#09090b" style={{ marginRight: 8 }} />
                <Text style={styles.loginButtonText}>INITIALIZE INTERFACE</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ==========================================
// 2. DASHBOARD SCREEN WITH LIVE METRICS & FILTERS
// ==========================================
const DashboardScreen = ({ navigation }) => {
  const [activeDomain, setActiveDomain] = useState('LEADS');
  const [timeFilter, setTimeFilter] = useState('30D');
  const [refreshKey, setRefreshKey] = useState(0);

  // Compute Live Valuation from store
  const totalLeadValuation = GlobalDataStore.leads.reduce((sum, item) => sum + item.deposit, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => navigation.openDrawer()} style={{ marginRight: 16 }}>
              <Menu size={24} color="#00E5FF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.sectionHeading}>Executive Command</Text>
              <Text style={styles.sectionEyebrow}>Live operational metrics</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setRefreshKey(prev => prev + 1)} style={styles.refreshBtn}>
            <RefreshCw size={16} color="#00E5FF" />
          </TouchableOpacity>
        </View>

        {/* Dynamic Metric Cards */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={[styles.dashboardMetricItem, activeDomain === 'LEADS' && styles.activeItemCard]} onPress={() => setActiveDomain('LEADS')}>
            <View style={[styles.metricIconWrap, activeDomain === 'LEADS' && styles.metricIconWrapActive]}>
              <TrendingUp size={18} color={activeDomain === 'LEADS' ? '#00E5FF' : '#666'} />
            </View>
            <Text style={styles.dashboardMetricNumber}>${totalLeadValuation.toLocaleString()}</Text>
            <Text style={styles.dashboardMetricLabel}>Live Leads Value</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.dashboardMetricItem, activeDomain === 'SHIPMENTS' && styles.activeItemCard]} onPress={() => setActiveDomain('SHIPMENTS')}>
            <View style={[styles.metricIconWrap, activeDomain === 'SHIPMENTS' && styles.metricIconWrapActive]}>
              <Container size={18} color={activeDomain === 'SHIPMENTS' ? '#00E5FF' : '#666'} />
            </View>
            <Text style={styles.dashboardMetricNumber}>{GlobalDataStore.shipments.length}</Text>
            <Text style={styles.dashboardMetricLabel}>Active Cargo Manifests</Text>
          </TouchableOpacity>
        </View>

        {/* Time-Range Filter Bar */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
          <Text style={styles.sectionSubHeading}>Analytical Vector ({activeDomain})</Text>
          <View style={styles.timeFilterContainer}>
            {['7D', '30D', 'YTD'].map((range) => (
              <TouchableOpacity key={range} onPress={() => setTimeFilter(range)} style={[styles.timeFilterBadge, timeFilter === range && styles.timeFilterBadgeActive]}>
                <Text style={[styles.timeFilterText, timeFilter === range && styles.timeFilterTextActive]}>{range}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Interactive Dynamic Chart */}
        <View style={styles.graphContainerCanvas}>
          <View style={styles.graphBarsAxisContainer}>
            {GlobalDataStore.leads.map((item, index) => {
              const barHeight = Math.min(Math.max((item.deposit / 50000) * 150, 40), 160);
              return (
                <View key={index} style={styles.individualBarColumn}>
                  <Text style={styles.barMarkerValueText}>${(item.deposit / 1000).toFixed(0)}k</Text>
                  <View style={[styles.interactiveChartBarLine, { height: barHeight }]} />
                  <Text style={styles.barMarkerLabels}>{item.name.split(' ')[0]}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Partner Ledger */}
        <Text style={styles.sectionSubHeading}>Financing Partner Ledger</Text>
        <View style={styles.systemStatusLedgerAlertBox}>
          <View style={styles.ledgerIconWrap}><Layers size={18} color="#00E5FF" /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Habib Bank Credit Line</Text>
            <Text style={{ color: '#8a8a94', fontSize: 11, marginTop: 3 }}>Limit: $500,000 · Active</Text>
          </View>
          <View style={styles.activeDot} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ==========================================
// 3. MAYA AI CONSOLE SCREEN
// ==========================================
const MayaAgentConsoleScreen = ({ navigation }) => {
  const [messages, setMessages] = useState([
    { id: '1', text: 'Greetings Executive. Maya & Aether core online. Direct me to process lead records, query manifests, or schedule real-time reminders.', isBot: true }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const mayaEngine = useRef(new OperationalMayaEngine()).current;

  const handleSend = async () => {
    if (!inputText.trim() || isTyping) return;
    const userMsg = inputText;
    setMessages(prev => [...prev, { id: Date.now().toString(), text: userMsg, isBot: false }]);
    setInputText('');
    setIsTyping(true);

    const response = await mayaEngine.parseAndExecute(userMsg);
    
    setTimeout(() => {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: response, isBot: true }]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenHeader}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={{ marginRight: 12 }}>
          <Menu size={22} color="#00E5FF" />
        </TouchableOpacity>
        <Text style={styles.screenHeaderTitle}>Maya AI Advisory & Ops</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90} style={{ flex: 1 }}>
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => (
            <View style={[styles.msgBubble, item.isBot ? styles.botBubble : styles.userBubble]}>
              {item.isBot && <View style={styles.botAvatar}><Bot size={12} color="#00E5FF" /></View>}
              <Text style={[styles.msgText, !item.isBot && styles.userMsgText]}>{item.text}</Text>
            </View>
          )}
        />
        <View style={styles.inputContainer}>
          <TextInput style={styles.chatInput} placeholder="Command Maya..." placeholderTextColor="#4a4a55" value={inputText} onChangeText={setInputText} />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Send size={14} color="#09090b" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ==========================================
// 4. REPORTS VAULT SCREEN (PDF DOWNLOADS)
// ==========================================
const ReportsVaultScreen = ({ navigation }) => {
  const [generating, setGenerating] = useState(false);

  const generatePDFReport = async (reportTitle) => {
    setGenerating(true);
    const htmlContent = `
      <html>
        <body style="font-family: Helvetica; padding: 20px; color: #111;">
          <h1 style="color: #00E5FF;">OGAMOTO Enterprise Report</h1>
          <h2>${reportTitle}</h2>
          <hr />
          <p>Generated Date: ${new Date().toLocaleDateString()}</p>
          <h3>Active Leads Summary</h3>
          <ul>
            ${GlobalDataStore.leads.map(l => `<li><strong>${l.name}</strong> - ${l.vehicle} ($${l.deposit})</li>`).join('')}
          </ul>
        </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri);
    } catch (e) {
      Alert.alert('Report Error', 'Could not generate or share PDF document.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenHeader}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={{ marginRight: 12 }}>
          <Menu size={22} color="#00E5FF" />
        </TouchableOpacity>
        <Text style={styles.screenHeaderTitle}>Reports Vault</Text>
      </View>

      <ScrollView style={{ padding: 20 }}>
        {GlobalDataStore.reports.map((item) => (
          <View key={item.id} style={styles.reportCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <FileText size={24} color="#00E5FF" style={{ marginRight: 14 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{item.title}</Text>
                <Text style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{item.date} · {item.size}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.downloadBtn} onPress={() => generatePDFReport(item.title)} disabled={generating}>
              <Download size={16} color="#09090b" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

// ==========================================
// 5. CRM WEBVIEW PORTAL SCREEN
// ==========================================
const CRMWebViewScreen = ({ navigation, route }) => {
  const targetUri = route.params?.uri || 'https://pap-crm.vercel.app/';
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenHeader}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={{ marginRight: 12 }}>
          <Menu size={22} color="#00E5FF" />
        </TouchableOpacity>
        <Text style={styles.screenHeaderTitle}>CRM Web Portal</Text>
      </View>
      <WebView source={{ uri: targetUri }} style={{ flex: 1 }} startInLoadingState={true} />
    </SafeAreaView>
  );
};

// ==========================================
// CUSTOM DRAWER MENU CONTENT
// ==========================================
function CustomDrawerContent(props) {
  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: '#09090b' }}>
      <View style={styles.drawerHeader}>
        <Bot size={32} color="#00E5FF" />
        <Text style={styles.drawerBrandText}>OGAMOTO CRM</Text>
        <Text style={styles.drawerUserText}>John Doe (Admin)</Text>
      </View>
      <DrawerItemList {...props} />
      <DrawerItem
        label="Logout"
        icon={({ color }) => <LogOut size={18} color="#ff4d4d" />}
        labelStyle={{ color: '#ff4d4d', fontWeight: '600' }}
        onPress={() => props.navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
      />
    </DrawerContentScrollView>
  );
}

// ==========================================
// MAIN DRAWER NAVIGATOR (SIDEBAR REPLACEMENT)
// ==========================================
function MainDrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: '#09090b', width: 280 },
        drawerActiveTintColor: '#00E5FF',
        drawerInactiveTintColor: '#8a8a94',
        drawerLabelStyle: { fontWeight: '600', fontSize: 13 },
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} options={{ drawerIcon: ({ color }) => <LayoutDashboard size={18} color={color} /> }} />
      <Drawer.Screen name="Maya AI Console" component={MayaAgentConsoleScreen} options={{ drawerIcon: ({ color }) => <Bot size={18} color={color} /> }} />
      <Drawer.Screen name="Leads Pipeline" component={CRMWebViewScreen} initialParams={{ uri: 'https://pap-crm.vercel.app/leads' }} options={{ drawerIcon: ({ color }) => <TrendingUp size={18} color={color} /> }} />
      <Drawer.Screen name="Ports" component={CRMWebViewScreen} initialParams={{ uri: 'https://pap-crm.vercel.app/ports' }} options={{ drawerIcon: ({ color }) => <Anchor size={18} color={color} /> }} />
      <Drawer.Screen name="Shipments" component={CRMWebViewScreen} initialParams={{ uri: 'https://pap-crm.vercel.app/shipments' }} options={{ drawerIcon: ({ color }) => <Container size={18} color={color} /> }} />
      <Drawer.Screen name="Logistics" component={CRMWebViewScreen} initialParams={{ uri: 'https://pap-crm.vercel.app/logistics' }} options={{ drawerIcon: ({ color }) => <Truck size={18} color={color} /> }} />
      <Drawer.Screen name="Financing Partners" component={CRMWebViewScreen} initialParams={{ uri: 'https://pap-crm.vercel.app/financing' }} options={{ drawerIcon: ({ color }) => <Layers size={18} color={color} /> }} />
      <Drawer.Screen name="Workflow Console" component={CRMWebViewScreen} initialParams={{ uri: 'https://pap-crm.vercel.app/workflow' }} options={{ drawerIcon: ({ color }) => <Sliders size={18} color={color} /> }} />
      <Drawer.Screen name="Reports Vault" component={ReportsVaultScreen} options={{ drawerIcon: ({ color }) => <FileText size={18} color={color} /> }} />
      <Drawer.Screen name="Settings" component={CRMWebViewScreen} initialParams={{ uri: 'https://pap-crm.vercel.app/settings' }} options={{ drawerIcon: ({ color }) => <Settings size={18} color={color} /> }} />
    </Drawer.Navigator>
  );
}

// ==========================================
// ROOT APP
// ==========================================
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#09090b' }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="MainDrawer" component={MainDrawerNavigator} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

// ==========================================
// STYLESHEET
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  screenHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a22', backgroundColor: '#09090b' },
  screenHeaderTitle: { color: '#00E5FF', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },

  loginContainer: { flex: 1, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center' },
  loginGlow: { position: 'absolute', width: width * 1.4, height: width * 1.4, borderRadius: width * 0.7, backgroundColor: '#00E5FF', opacity: 0.06, top: -width * 0.6 },
  loginCard: { width: width * 0.85, padding: 28, backgroundColor: '#101014', borderRadius: 24, borderWidth: 1, borderColor: '#1a1a22' },
  brandBadge: { alignSelf: 'center', width: 52, height: 52, borderRadius: 16, backgroundColor: '#09090b', borderWidth: 1, borderColor: '#1a1a22', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  loginBrandText: { fontSize: 30, fontWeight: '900', color: '#00E5FF', textAlign: 'center', letterSpacing: 6 },
  loginTagline: { fontSize: 10, color: '#fff', opacity: 0.4, textAlign: 'center', letterSpacing: 2, marginBottom: 32, marginTop: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#09090b', borderWidth: 1, borderColor: '#1a1a22', borderRadius: 14, marginBottom: 16, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  authInputField: { flex: 1, height: 50, color: '#fff', fontSize: 14 },
  loginSubmitButton: { backgroundColor: '#00E5FF', height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  loginSubmitButtonDisabled: { opacity: 0.7 },
  loginButtonText: { color: '#09090b', fontWeight: '800', fontSize: 13, letterSpacing: 1 },

  drawerHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#1a1a22', marginBottom: 10 },
  drawerBrandText: { color: '#00E5FF', fontWeight: '900', fontSize: 18, marginTop: 8 },
  drawerUserText: { color: '#666', fontSize: 12, marginTop: 2 },

  refreshBtn: { padding: 8, backgroundColor: '#101014', borderRadius: 10, borderWidth: 1, borderColor: '#1a1a22' },
  sectionHeading: { fontSize: 22, fontWeight: '800', color: '#fff' },
  sectionEyebrow: { fontSize: 11, color: '#666', marginTop: 2, fontWeight: '600' },
  sectionSubHeading: { fontSize: 12, fontWeight: '700', color: '#00E5FF', letterSpacing: 1 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dashboardMetricItem: { backgroundColor: '#101014', width: '48%', padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#1a1a22' },
  activeItemCard: { borderColor: '#00E5FF' },
  metricIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center' },
  metricIconWrapActive: { backgroundColor: 'rgba(0,229,255,0.1)' },
  dashboardMetricNumber: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 12 },
  dashboardMetricLabel: { color: '#777', fontSize: 11, marginTop: 4, fontWeight: '600' },

  timeFilterContainer: { flexDirection: 'row', backgroundColor: '#101014', borderRadius: 8, padding: 2, borderWidth: 1, borderColor: '#1a1a22' },
  timeFilterBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  timeFilterBadgeActive: { backgroundColor: '#00E5FF' },
  timeFilterText: { color: '#666', fontSize: 10, fontWeight: '700' },
  timeFilterTextActive: { color: '#09090b' },

  systemStatusLedgerAlertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101014', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#1a1a22', marginTop: 12 },
  ledgerIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00E5A0' },

  graphContainerCanvas: { backgroundColor: '#101014', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#1a1a22', height: 210, justifyContent: 'flex-end' },
  graphBarsAxisContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', width: '100%' },
  individualBarColumn: { alignItems: 'center' },
  interactiveChartBarLine: { width: 34, backgroundColor: '#00E5FF', borderRadius: 6 },
  barMarkerLabels: { color: '#666', fontSize: 10, marginTop: 10, fontWeight: '700' },
  barMarkerValueText: { color: '#fff', fontSize: 10, marginBottom: 6, fontWeight: '600' },

  msgBubble: { padding: 14, borderRadius: 18, marginVertical: 6, maxWidth: '85%', flexDirection: 'row', alignItems: 'flex-start' },
  botBubble: { backgroundColor: '#101014', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#1a1a22' },
  userBubble: { backgroundColor: '#00E5FF', alignSelf: 'flex-end' },
  botAvatar: { width: 20, height: 20, borderRadius: 6, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', marginRight: 8, marginTop: 1 },
  msgText: { color: '#eaeaea', fontSize: 13, lineHeight: 19, flexShrink: 1 },
  userMsgText: { color: '#09090b', fontWeight: '600' },

  inputContainer: { flexDirection: 'row', padding: 16, backgroundColor: '#09090b', borderTopWidth: 1, borderTopColor: '#1a1a22', alignItems: 'center' },
  chatInput: { flex: 1, backgroundColor: '#101014', color: '#fff', paddingHorizontal: 18, height: 48, borderRadius: 24, marginRight: 12, borderWidth: 1, borderColor: '#1a1a22' },
  sendButton: { backgroundColor: '#00E5FF', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },

  reportCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#101014', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#1a1a22', marginBottom: 12 },
  downloadBtn: { backgroundColor: '#00E5FF', padding: 10, borderRadius: 10 },
});
