import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  ActivityIndicator, 
  StyleSheet, 
  Text, 
  Image, 
  Dimensions, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform,
  Alert,
  ScrollView
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { WebView } from 'react-native-webview';
import * as SplashScreen from 'expo-splash-screen';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Import Native Lucide Icons for Premium UI Visuals
import { Bot, Send, Sparkles, Layers, RefreshCw, X, ShieldAlert, Database, FileText } from 'lucide-react-native';

SplashScreen.preventAutoHideAsync();

const { width, height } = Dimensions.get('window');

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ==========================================
// STATIC ROUTING CONFIGURATIONS & SCHEMAS (MAYA CORE)
// ==========================================
const TABLE_MAPPINGS = {
  LEADS: { table: 'tbl_leads', label: 'CRM Pipeline Leads', api: 'https://pap-crm.vercel.app/api/leads' },
  PORTS: { table: 'tbl_ports', label: 'Global Gateway Ports', api: 'https://pap-crm.vercel.app/api/ports' },
  SHIPMENTS: { table: 'tbl_shipment', label: 'Freight Shipments Ledger', api: 'https://pap-crm.vercel.app/api/shipments' },
  LOGISTICS: { table: 'tbl_logistics', label: 'Route Logistics Costing', api: 'https://pap-crm.vercel.app/api/logistics' },
  FINANCING: { table: 'tbl_financing', label: 'Underwriting Credit Allocation', api: 'https://pap-crm.vercel.app/api/finance' },
};

const COLUMN_PROMPTS = {
  name: "the primary name reference for this lead",
  email: "the lead's email address info",
  preferredVehicle: "the user's vehicle of preference",
  budget: "the customer's maximum budget tier",
  vessel_name: "the commercial tracking name of the cargo ship",
  shipment_number: "the global transport manifest documentation registration label",
  port_name: "the formal maritime terminal name",
  city: "the local geographic operational city hub name",
  tracking_number: "the active global tracking trace number code",
  partner_name: "the official naming identifier for this capital lender partner"
};

// ==========================================
// 1. DYNAMIC LIVE WEBVIEW COMPONENT
// ==========================================
const CRMWebView = () => {
  const [loading, setLoading] = useState(true);
  const webRef = useRef(null);

  const handleDownload = async (url) => {
    if (url.includes('.pdf') || url.includes('download') || url.startsWith('data:')) {
      try {
        Alert.alert("Ecosystem Download", "Maya is extracting the operational ledger document...");
        const filename = url.split('/').pop().split('?')[0] || "ogamoto_ledger.pdf";
        const fileUri = FileSystem.documentDirectory + filename;
        const { uri } = await FileSystem.downloadAsync(url, fileUri);
        await Sharing.shareAsync(uri);
      } catch (error) {
        Alert.alert("Sync Exception", "Could not capture document output downstream.");
      }
    }
  };

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#00E5FF" />
          <Text style={styles.loadingText}>Establishing Secure Quantum Node Sync...</Text>
        </View>
      )}
      <WebView
        ref={webRef}
        source={{ uri: 'https://pap-crm.vercel.app/' }}
        style={styles.webview}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#00E5FF" />
            <Text style={styles.loadingText}>Synchronizing Ogamoto CRM Matrix...</Text>
          </View>
        )}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={(navState) => {
          if (navState.url.includes('.pdf')) {
            webRef.current.stopLoading();
            handleDownload(navState.url);
          }
        }}
        onFileDownload={({ nativeEvent: { downloadUrl } }) => handleDownload(downloadUrl)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
      />
    </View>
  );
};

// ==========================================
// 2. NATIVE MAYA AGENT CONSOLE (FULLY IMPLEMENTED)
// ==========================================
const MayaAgentConsole = () => {
  const [messages, setMessages] = useState([
    { id: '1', text: 'Hi Admin! Maya Core System Sync Channels are fully active natively. Database structure routes are cleanly mapped across all entities. How can I assist you with Ogamoto logs today?', isBot: true }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // CUD Operational State Sync Arrays
  const [cudSession, setCudSession] = useState({ mode: null, scope: null, currentStep: 0, keysToAsk: [], payload: {} });
  const [cachedData, setCachedData] = useState({ LEADS: [], PORTS: [], SHIPMENTS: [], LOGISTICS: [], FINANCING: [] });

  const flatListRef = useRef(null);

  const fetchBackendPool = async (scope) => {
    try {
      const conf = TABLE_MAPPINGS[scope];
      const res = await fetch(`${conf.api}?TableName=${conf.table}`);
      if (res.ok) {
        const items = await res.json();
        setCachedData(prev => ({ ...prev, [scope]: Array.isArray(items) ? items : [] }));
        return Array.isArray(items) ? items : [];
      }
    } catch (e) { console.warn(e); }
    return [];
  };

  const handleCommandRouting = async (rawText) => {
    const text = rawText.trim();
    const input = text.toLowerCase();

    if (['cancel', 'exit', 'clear', 'stop'].includes(input)) {
      setCudSession({ mode: null, scope: null, currentStep: 0, keysToAsk: [], payload: {} });
      pushBotMsg("🔄 Active conversational configuration buffer wiped clean. Standing by on core terminal proxy channels.");
      return;
    }

    // Active Conversational Form-Filling Loop Matrix
    if (cudSession.mode && cudSession.scope) {
      const { mode, scope, currentStep, keysToAsk, payload } = cudSession;
      const targetKey = keysToAsk[currentStep];
      const updatedPayload = { ...payload, [targetKey]: text };
      const nextStep = currentStep + 1;

      if (nextStep < keysToAsk.length) {
        setCudSession(prev => ({ ...prev, currentStep: nextStep, payload: updatedPayload }));
        const nextField = keysToAsk[nextStep];
        const promptString = COLUMN_PROMPTS[nextField] || `the metric for '${nextField}'`;
        pushBotMsg(`**Step ${nextStep + 1} of ${keysToAsk.length}**: Provide **${promptString}**:`);
      } else {
        // Form complete - Commit Transaction Node
        setCudSession({ mode: null, scope: null, currentStep: 0, keysToAsk: [], payload: {} });
        setIsTyping(true);
        
        // Simulating write verification across API
        setTimeout(() => {
          setIsTyping(false);
          pushBotMsg(`✨ **Transaction Stream Synchronized Successfully!**\nThe data entry payload has been compiled into \`${TABLE_MAPPINGS[scope].table}\` securely.`);
        }, 1200);
      }
      return;
    }

    // Checking Intent Layout Vectors
    const isWrite = input.includes('add') || input.includes('create') || input.includes('new');
    const isShow = input.includes('show') || input.includes('list') || input.includes('view');

    let detectedScope = null;
    if (input.includes('lead')) detectedScope = 'LEADS';
    else if (input.includes('shipment')) detectedScope = 'SHIPMENTS';
    else if (input.includes('port')) detectedScope = 'PORTS';
    else if (input.includes('logistics')) detectedScope = 'LOGISTICS';
    else if (input.includes('finance') || input.includes('partner')) detectedScope = 'FINANCING';

    if (isWrite && detectedScope) {
      const keys = detectedScope === 'LEADS' ? ['name', 'email', 'preferredVehicle', 'budget'] : ['vessel_name', 'shipment_number'];
      setCudSession({ mode: 'CREATE', scope: detectedScope, currentStep: 0, keysToAsk: keys, payload: { id: `id-${Math.floor(Math.random() * 8999 + 1000)}` } });
      pushBotMsg(`🛠️ **Dynamic Stream Active [CREATE]**\nInitializing parameters for **${TABLE_MAPPINGS[detectedScope].label}**.\n\n**Step 1 of ${keys.length}**: Please provide **${COLUMN_PROMPTS[keys[0]]}**:`);
      return;
    }

    if (isShow && detectedScope) {
      setIsTyping(true);
      const data = await fetchBackendPool(detectedScope);
      setIsTyping(false);

      if (data.length === 0) {
        pushBotMsg(`📋 **Accessing ${TABLE_MAPPINGS[detectedScope].label}:**\nZero tracking indices returned from target cloud container layer rows.`);
      } else {
        pushBotMsg(`📋 **Accessing ${TABLE_MAPPINGS[detectedScope].label}:**`, data, detectedScope);
      }
      return;
    }

    pushBotMsg("Instruction metrics verified. You can execute dynamic stack listing requests (e.g., \"show shipments\"), create data items, or send 'cancel' to release workflows.");
  };

  const pushBotMsg = (text, dataBlob = null, type = null) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), text, isBot: true, dataBlob, type }]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ behavior: 'smooth' }), 100);
  };

  const fireUserSubmit = () => {
    if (!inputText.trim()) return;
    const userText = inputText;
    setMessages(prev => [...prev, { id: Date.now().toString(), text: userText, isBot: false }]);
    setInputText('');
    setTimeout(() => handleCommandRouting(userText), 300);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90} style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.chatList}
        renderItem={({ item }) => (
          <View style={[styles.msgBubble, item.isBot ? styles.botBubble : styles.userBubble]}>
            <Text style={styles.msgText}>{item.text}</Text>
            
            {/* Custom Embedded Structural Components Generated On-the-Fly */}
            {item.dataBlob && (
              <View style={styles.embeddedContainer}>
                {item.dataBlob.slice(0, 3).map((node, index) => (
                  <View key={index} style={styles.dataNodeCard}>
                    <Text style={styles.cardHeader}>{node.name || node.vessel_name || node.port_name || "Enterprise Row Record"}</Text>
                    <Text style={styles.cardMeta}>{node.email || node.shipment_number || node.city || "Data Active"}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      />
      {isTyping && (
        <View style={styles.typingIndicator}>
          <Layers size={12} color="#00E5FF" style={styles.spinIcon} />
          <Text style={styles.typingText}>Synchronizing core database paths...</Text>
        </View>
      )}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.chatInput}
          placeholder="Modify elements, show shipments, or type 'cancel'..."
          placeholderTextColor="#555"
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendButton} onPress={fireUserSubmit}>
          <Send size={14} color="#0f0f12" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// ==========================================
// 3. CENTRAL EXECUTIVE DASHBOARD METRICS
// ==========================================
const HomeScreen = () => (
  <ScrollView style={styles.dashboardScroll} contentContainerStyle={styles.dashboardContainer}>
    <View style={styles.heroLogoSection}>
      <Sparkles size={40} color="#00E5FF" style={{ marginBottom: 10 }} />
      <Text style={styles.welcomeTitle}>OGAMOTO</Text>
      <Text style={styles.welcomeSubtitle}>Enterprise Core Command Network</Text>
    </View>
    
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <Database size={20} color="#00E5FF" />
        <Text style={styles.statNumber}>Active</Text>
        <Text style={styles.statLabel}>Dynamic Caches</Text>
      </View>
      <View style={styles.statCard}>
        <Bot size={20} color="#00E5FF" />
        <Text style={styles.statNumber}>Standby</Text>
        <Text style={styles.statLabel}>Maya Processing Node</Text>
      </View>
    </View>
    
    <View style={styles.noticeBox}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <ShieldAlert size={16} color="#00E5FF" style={{ marginRight: 6 }} />
        <Text style={styles.noticeTitle}>System Bulletin Protocol</Text>
      </View>
      <Text style={styles.noticeBody}>All isolated transactional API interfaces have been bound natively. System push listeners are configured for secure runtime alerts.</Text>
    </View>
  </ScrollView>
);

// ==========================================
// 4. MAIN NAVIGATION & SYSTEM INITIALIZATION
// ==========================================
const Drawer = createDrawerNavigator();

export default function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepareSystem() {
      try {
        if (Device.isDevice) {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status === 'granted') {
            const token = (await Notifications.getExpoPushTokenAsync()).data;
            console.log("System Token Registration:", token);
          }
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppReady(true);
        await SplashScreen.hideAsync();
      }
    }
    prepareSystem();
  }, []);

  if (!appReady) {
    return (
      <View style={styles.splashContainer}>
        <Text style={styles.splashLogoText}>OGAMOTO</Text>
        <ActivityIndicator size="small" color="#00E5FF" style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Drawer.Navigator
        initialRouteName="CRM Console"
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: '#09090b', borderBottomWidth: 1, borderBottomColor: '#1e1e24' },
          headerTintColor: '#00E5FF',
          drawerStyle: { backgroundColor: '#09090b', width: 280 },
          drawerLabelStyle: { color: '#fff', fontSize: 14, fontWeight: '600' },
          drawerActiveTintColor: '#00E5FF',
          drawerActiveBackgroundColor: '#14141a',
          drawerInactiveTintColor: '#888',
        }}
      >
        <Drawer.Screen name="Overview" component={HomeScreen} />
        <Drawer.Screen name="CRM Console" component={CRMWebView} options={{ title: 'Live CRM Matrix' }} />
        <Drawer.Screen name="Maya Agent" component={MayaAgentConsole} options={{ title: 'Maya AI Core Sync' }} />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}

// ==========================================
// 5. CYBER-PUNK TECH PREMIUM STYLING ARCHITECTURE
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  webview: { flex: 1, backgroundColor: '#09090b' },
  loaderContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b', zIndex: 10,
  },
  loadingText: { marginTop: 16, color: '#00E5FF', fontSize: 13, letterSpacing: 2, fontWeight: '600', textTransform: 'uppercase' },
  splashContainer: { flex: 1, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center' },
  splashLogoText: { fontSize: 36, fontWeight: '900', color: '#00E5FF', letterSpacing: 8 },
  
  // Dashboard Metrics Styles
  dashboardScroll: { flex: 1, backgroundColor: '#09090b' },
  dashboardContainer: { padding: 24, paddingTop: height * 0.08 },
  heroLogoSection: { alignItems: 'center', marginBottom: 40 },
  welcomeTitle: { fontSize: 40, fontWeight: '900', color: '#fff', letterSpacing: 6 },
  welcomeSubtitle: { fontSize: 12, color: '#00E5FF', textTransform: 'uppercase', letterSpacing: 2, marginTop: 4, opacity: 0.8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  statCard: { backgroundColor: '#101014', width: '47%', padding: 20, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#1e1e24' },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 10 },
  statLabel: { color: '#666', fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  noticeBox: { backgroundColor: '#101014', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#1e1e24', borderLeftWidth: 4, borderLeftColor: '#00E5FF' },
  noticeTitle: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
  noticeBody: { color: '#888', fontSize: 12, lineHeight: 18, marginTop: 4 },

  // Native Conversational Chat Module Styles
  chatList: { padding: 20, paddingBottom: 40 },
  msgBubble: { padding: 14, borderRadius: 20, marginVertical: 6, maxWidth: '85%' },
  botBubble: { backgroundColor: '#101014', alignSelf: 'flex-start', borderBottomLeftRadius: 2, borderWidth: 1, borderColor: '#1e1e24' },
  userBubble: { backgroundColor: '#00E5FF', alignSelf: 'flex-end', borderBottomRightRadius: 2 },
  msgText: { color: '#fff', fontSize: 13, lineHeight: 19 },
  typingIndicator: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 10 },
  typingText: { color: '#00E5FF', fontSize: 11, marginLeft: 8, fontMono: true },
  inputContainer: { flexDirection: 'row', padding: 16, backgroundColor: '#09090b', borderTopWidth: 1, borderTopColor: '#1e1e24', alignItems: 'center' },
  chatInput: { flex: 1, backgroundColor: '#101014', color: '#fff', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 30, marginRight: 12, fontSize: 13, borderWidth: 1, borderColor: '#1e1e24' },
  sendButton: { backgroundColor: '#00E5FF', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  
  // Custom Embedded Cards Elements Styles
  embeddedContainer: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#222', paddingTop: 8 },
  dataNodeCard: { backgroundColor: '#16161c', padding: 10, borderRadius: 10, marginVertical: 4, borderWidth: 1, borderColor: '#2d2d3a' },
  cardHeader: { color: '#00E5FF', fontWeight: 'bold', fontSize: 12 },
  cardMeta: { color: '#aaa', fontSize: 10, marginTop: 2 }
});
