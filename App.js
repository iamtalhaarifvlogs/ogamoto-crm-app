import 'react-native-gesture-handler';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Dimensions, FlatList, KeyboardAvoidingView, Platform, Alert, ScrollView,
  SafeAreaView, ActivityIndicator, Animated, Easing, LayoutAnimation, UIManager,
  RefreshControl,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { WebView } from 'react-native-webview';

// Expo Modules for Notifications, PDF Generation & File System
import * as Notifications from 'expo-notifications';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

// Vector Icons
import {
  Bot, Send, LogIn, LayoutDashboard, Globe,
  User, Lock, TrendingUp, Container, Layers, LogOut, Eye, EyeOff,
  Menu, FileText, Download, Anchor, Truck, Sliders, Settings, Plus, RefreshCw, Bell,
  CheckCircle2, Clock, PackageCheck,
} from 'lucide-react-native';

// Smooth native layout transitions on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
const ACCENT = '#00E5FF';

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
  financing: [
    { id: 'F1', partner: 'Habib Bank Credit Line', limit: 500000, used: 182000, status: 'Active' },
  ],
  listeners: [],
  subscribe(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  },
  notify() {
    this.listeners.forEach(fn => fn());
  },
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
    this.notify();
    return newLead;
  },
  stats() {
    const totalLeadValue = this.leads.reduce((s, l) => s + l.deposit, 0);
    const totalUnits = this.shipments.reduce((s, sh) => s + sh.units, 0);
    const byStatus = this.leads.reduce((acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {});
    return { totalLeadValue, totalUnits, byStatus };
  }
};

// ==========================================
// MAYA & AETHER AI ENGINE (WITH RELIABLE PUSH NOTIFICATIONS)
// ==========================================
class OperationalMayaEngine {
  async ensureAndroidChannel() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Maya Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: ACCENT,
      });
    }
  }

  async requestNotificationPermission() {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  async scheduleNotification(seconds, title, body) {
    const hasPermission = await this.requestNotificationPermission();
    if (!hasPermission) {
      return 'Notification permission is off. Enable alerts for OGAMOTO in your device Settings, then try again.';
    }
    await this.ensureAndroidChannel();

    const safeSeconds = Math.max(1, Math.round(seconds));
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || 'OGAMOTO Alert',
        body: body || 'Scheduled Maya action.',
        sound: true,
      },
      trigger: {
        seconds: safeSeconds,
        repeats: false,
        ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
      },
    });

    const unit = safeSeconds === 1 ? 'second' : 'seconds';
    return `Notification confirmed. I'll alert you in ${safeSeconds} ${unit}: "${body}"`;
  }

  async parseAndExecute(input) {
    const lower = input.toLowerCase();

    // 1. Handle Reminders / Notifications
    if (lower.includes('notify') || lower.includes('remind')) {
      const secMatch = lower.match(/in\s+(\d+)\s*(?:seconds?|secs?|s)\b/);
      const minMatch = lower.match(/in\s+(\d+)\s*(?:minutes?|mins?|m)\b/);
      let delaySeconds = 60;
      if (secMatch) delaySeconds = parseInt(secMatch[1], 10);
      else if (minMatch) delaySeconds = parseInt(minMatch[1], 10) * 60;

      let taskText = input.trim();
      const toMatch = input.match(/to\s+(.+)/i);
      if (toMatch && toMatch[1].trim()) taskText = toMatch[1].trim();

      return await this.scheduleNotification(delaySeconds, 'Maya Reminder', taskText);
    }

    // 2. Handle Lead Display Queries
    if (lower.includes('show lead') || lower.includes('list lead') || lower.includes('get lead')) {
      const leadsList = GlobalDataStore.leads.map(l => `• ${l.name} - ${l.vehicle} ($${l.deposit.toLocaleString()}) [${l.status}]`).join('\n');
      return `**Current Pipeline Leads:**\n\n${leadsList}`;
    }

    // 3. Handle Add Lead Directives (CUD)
    if (lower.includes('add') && lower.includes('lead')) {
      const depositMatch = input.match(/\$(\d+)/) || input.match(/of\s+(\d+)/);
      const depositVal = depositMatch ? depositMatch[1] : 0;

      let nameVal = 'New Lead';
      if (lower.includes('add ')) {
        const afterAdd = input.split(/add/i)[1] || '';
        const asMatch = afterAdd.split(/as a|for/i)[0];
        if (asMatch && asMatch.trim()) nameVal = asMatch.trim();
      }

      let vehicleVal = 'Vehicle Unit';
      if (lower.includes('for ')) {
        const afterFor = input.split(/for/i)[1] || '';
        const withMatch = afterFor.split(/with|\$/i)[0];
        if (withMatch && withMatch.trim()) vehicleVal = withMatch.trim();
      }

      const created = GlobalDataStore.addLead({ name: nameVal, vehicle: vehicleVal, deposit: depositVal });

      return `**Aether Execution Update:**\nStatus: SUCCESS\nEntity: LEADS\nAction: CREATE\n\nRecorded Lead: ${created.name}\nVehicle: ${created.vehicle}\nDeposit: $${created.deposit.toLocaleString()}`;
    }

    return "Executive directive logged. Aether state synchronized. Try: \"show leads\", \"add lead John for Toyota Corolla $5000\", or \"remind me in 30 seconds to...\"";
  }
}

// ==========================================
// REUSABLE ANIMATED PRIMITIVES
// ==========================================
const AnimatedPressable = ({ onPress, style, children, disabled, hitSlop }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 8 }).start();
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      hitSlop={hitSlop || { top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  );
};

const IconButton = ({ onPress, children, style }) => (
  <AnimatedPressable
    onPress={onPress}
    hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
    style={[styles.iconButtonTarget, style]}
  >
    {children}
  </AnimatedPressable>
);

const FadeSlideIn = ({ children, delay = 0, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

const PulsingDot = ({ color = '#00E5A0', size = 8 }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: pulse }} />;
};

const AnimatedChartBar = ({ targetHeight, delay = 0 }) => {
  const height = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(height, {
      toValue: targetHeight,
      duration: 550,
      delay,
      easing: Easing.out(Easing.exp),
      useNativeDriver: false,
    }).start();
  }, [targetHeight]);
  return <Animated.View style={[styles.interactiveChartBarLine, { height }]} />;
};

const TypingDots = () => {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(d, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - i) * 140),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={{
            width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT, marginHorizontal: 2,
            opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
            transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
          }}
        />
      ))}
    </View>
  );
};

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
        <FadeSlideIn style={styles.loginCard}>
          <View style={styles.brandBadge}><Bot size={22} color={ACCENT} /></View>
          <Text style={styles.loginBrandText}>OGAMOTO</Text>
          <Text style={styles.loginTagline}>ENTERPRISE SYSTEM PORTAL</Text>

          <View style={styles.inputWrapper}>
            <User size={15} color={ACCENT} style={styles.inputIcon} />
            <TextInput style={styles.authInputField} placeholder="Admin Identifier" placeholderTextColor="#4a4a55" value={username} onChangeText={setUsername} autoCapitalize="none" />
          </View>

          <View style={styles.inputWrapper}>
            <Lock size={15} color={ACCENT} style={styles.inputIcon} />
            <TextInput style={styles.authInputField} placeholder="Access Key" placeholderTextColor="#4a4a55" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} autoCapitalize="none" />
            <IconButton onPress={() => setShowPassword(v => !v)} style={{ paddingHorizontal: 4 }}>
              {showPassword ? <EyeOff size={16} color="#555" /> : <Eye size={16} color="#555" />}
            </IconButton>
          </View>

          <AnimatedPressable style={[styles.loginSubmitButton, isLoggingIn && styles.loginSubmitButtonDisabled]} onPress={handleLogin} disabled={isLoggingIn}>
            {isLoggingIn ? <ActivityIndicator color="#09090b" /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <LogIn size={15} color="#09090b" style={{ marginRight: 8 }} />
                <Text style={styles.loginButtonText}>INITIALIZE INTERFACE</Text>
              </View>
            )}
          </AnimatedPressable>
        </FadeSlideIn>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ==========================================
// 2. DASHBOARD SCREEN WITH LIVE METRICS & WORKING FILTERS
// ==========================================
const FILTER_DAYS = { '7D': 7, '30D': 30, 'YTD': null };

const DashboardScreen = ({ navigation }) => {
  const [activeDomain, setActiveDomain] = useState('LEADS');
  const [timeFilter, setTimeFilter] = useState('30D');
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  // Re-derive data whenever the screen regains focus (e.g. after Maya adds a lead)
  useFocusEffect(useCallback(() => {
    setTick(t => t + 1);
    const unsub = GlobalDataStore.subscribe(() => setTick(t => t + 1));
    return unsub;
  }, []));

  const filteredLeads = useMemo(() => {
    const now = new Date();
    return GlobalDataStore.leads.filter(l => {
      const d = new Date(l.date);
      if (timeFilter === 'YTD') {
        return d.getFullYear() === now.getFullYear();
      }
      const days = FILTER_DAYS[timeFilter];
      const diffDays = (now - d) / (1000 * 60 * 60 * 24);
      return diffDays <= days && diffDays >= -1;
    });
  }, [timeFilter, tick]);

  const totalLeadValuation = filteredLeads.reduce((sum, item) => sum + item.deposit, 0);
  const statusBreakdown = filteredLeads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});
  const shipmentUnits = GlobalDataStore.shipments.reduce((s, sh) => s + sh.units, 0);
  const inTransitCount = GlobalDataStore.shipments.filter(s => s.status === 'In Transit').length;
  const customsCount = GlobalDataStore.shipments.filter(s => s.status === 'Customs').length;

  const chartData = activeDomain === 'LEADS'
    ? filteredLeads.map(l => ({ label: l.name.split(' ')[0], value: l.deposit, max: 50000 }))
    : GlobalDataStore.shipments.map(s => ({ label: s.container, value: s.units, max: 400 }));

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setTick(t => t + 1);
      setRefreshing(false);
    }, 700);
  };

  const changeFilter = (range) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTimeFilter(range);
  };

  const changeDomain = (domain) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveDomain(domain);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
            <IconButton onPress={() => navigation.openDrawer()} style={{ marginRight: 10 }}>
              <Menu size={22} color={ACCENT} />
            </IconButton>
            <View>
              <Text style={styles.sectionHeading}>Executive Command</Text>
              <Text style={styles.sectionEyebrow}>Live operational metrics</Text>
            </View>
          </View>
          <IconButton onPress={onRefresh} style={styles.refreshBtn}>
            {refreshing ? <ActivityIndicator size="small" color={ACCENT} /> : <RefreshCw size={16} color={ACCENT} />}
          </IconButton>
        </View>

        {/* Dynamic Metric Cards */}
        <View style={styles.statsRow}>
          <AnimatedPressable style={[styles.dashboardMetricItem, activeDomain === 'LEADS' && styles.activeItemCard]} onPress={() => changeDomain('LEADS')}>
            <View style={[styles.metricIconWrap, activeDomain === 'LEADS' && styles.metricIconWrapActive]}>
              <TrendingUp size={17} color={activeDomain === 'LEADS' ? ACCENT : '#666'} />
            </View>
            <Text style={styles.dashboardMetricNumber}>${totalLeadValuation.toLocaleString()}</Text>
            <Text style={styles.dashboardMetricLabel}>Leads Value ({timeFilter})</Text>
          </AnimatedPressable>

          <AnimatedPressable style={[styles.dashboardMetricItem, activeDomain === 'SHIPMENTS' && styles.activeItemCard]} onPress={() => changeDomain('SHIPMENTS')}>
            <View style={[styles.metricIconWrap, activeDomain === 'SHIPMENTS' && styles.metricIconWrapActive]}>
              <Container size={17} color={activeDomain === 'SHIPMENTS' ? ACCENT : '#666'} />
            </View>
            <Text style={styles.dashboardMetricNumber}>{shipmentUnits}</Text>
            <Text style={styles.dashboardMetricLabel}>Units In Transit</Text>
          </AnimatedPressable>
        </View>

        {/* Time-Range Filter Bar — now actually filters the data above */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10 }}>
          <Text style={styles.sectionSubHeading}>Analytical Vector ({activeDomain})</Text>
          <View style={styles.timeFilterContainer}>
            {['7D', '30D', 'YTD'].map((range) => (
              <AnimatedPressable key={range} onPress={() => changeFilter(range)} style={[styles.timeFilterBadge, timeFilter === range && styles.timeFilterBadgeActive]}>
                <Text style={[styles.timeFilterText, timeFilter === range && styles.timeFilterTextActive]}>{range}</Text>
              </AnimatedPressable>
            ))}
          </View>
        </View>
        {activeDomain === 'SHIPMENTS' && (
          <Text style={styles.filterNote}>Shipment data is real-time and not date-filtered.</Text>
        )}

        {/* Interactive Animated Chart */}
        <View style={styles.graphContainerCanvas}>
          {chartData.length === 0 ? (
            <Text style={styles.emptyStateText}>No {activeDomain.toLowerCase()} in this range.</Text>
          ) : (
            <View style={styles.graphBarsAxisContainer}>
              {chartData.map((item, index) => {
                const barHeight = Math.min(Math.max((item.value / item.max) * 150, 30), 160);
                return (
                  <View key={index} style={styles.individualBarColumn}>
                    <Text style={styles.barMarkerValueText}>
                      {activeDomain === 'LEADS' ? `$${(item.value / 1000).toFixed(0)}k` : item.value}
                    </Text>
                    <AnimatedChartBar targetHeight={barHeight} delay={index * 80} />
                    <Text style={styles.barMarkerLabels}>{item.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Pipeline Status Breakdown */}
        <Text style={[styles.sectionSubHeading, { marginTop: 22, marginBottom: 10 }]}>Pipeline Status ({timeFilter})</Text>
        <View style={styles.statusRow}>
          {['Active', 'Pipeline', 'Closed'].map((s) => (
            <View key={s} style={styles.statusChip}>
              <Text style={styles.statusChipCount}>{statusBreakdown[s] || 0}</Text>
              <Text style={styles.statusChipLabel}>{s}</Text>
            </View>
          ))}
        </View>

        {/* Recent Leads List */}
        <Text style={[styles.sectionSubHeading, { marginTop: 22, marginBottom: 10 }]}>Recent Leads</Text>
        {filteredLeads.length === 0 ? (
          <Text style={styles.emptyStateText}>No leads recorded in this window.</Text>
        ) : filteredLeads.map((lead, i) => (
          <FadeSlideIn key={lead.id} delay={i * 60} style={styles.leadRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.leadName}>{lead.name}</Text>
              <Text style={styles.leadSub}>{lead.vehicle} · {lead.date}</Text>
            </View>
            <Text style={styles.leadDeposit}>${lead.deposit.toLocaleString()}</Text>
            <View style={[styles.statusBadge, statusColor(lead.status)]}>
              <Text style={styles.statusBadgeText}>{lead.status}</Text>
            </View>
          </FadeSlideIn>
        ))}

        {/* Shipments Snapshot */}
        <Text style={[styles.sectionSubHeading, { marginTop: 22, marginBottom: 10 }]}>Cargo & Logistics</Text>
        <View style={styles.shipmentSummaryRow}>
          <View style={styles.shipmentSummaryChip}>
            <Clock size={14} color={ACCENT} />
            <Text style={styles.shipmentSummaryText}>{inTransitCount} In Transit</Text>
          </View>
          <View style={styles.shipmentSummaryChip}>
            <PackageCheck size={14} color={ACCENT} />
            <Text style={styles.shipmentSummaryText}>{customsCount} In Customs</Text>
          </View>
        </View>
        {GlobalDataStore.shipments.map((s, i) => (
          <FadeSlideIn key={s.id} delay={i * 60} style={styles.shipmentRow}>
            <Container size={16} color="#8a8a94" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.leadName}>{s.container} · {s.vessel}</Text>
              <Text style={styles.leadSub}>{s.origin} · {s.units} units</Text>
            </View>
            <Text style={styles.shipmentStatusText}>{s.status}</Text>
          </FadeSlideIn>
        ))}

        {/* Partner Ledger */}
        <Text style={[styles.sectionSubHeading, { marginTop: 22, marginBottom: 10 }]}>Financing Partner Ledger</Text>
        {GlobalDataStore.financing.map((f) => (
          <View key={f.id} style={styles.systemStatusLedgerAlertBox}>
            <View style={styles.ledgerIconWrap}><Layers size={17} color={ACCENT} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{f.partner}</Text>
              <Text style={{ color: '#8a8a94', fontSize: 11, marginTop: 3 }}>
                Limit: ${f.limit.toLocaleString()} · Used: ${f.used.toLocaleString()} · {f.status}
              </Text>
            </View>
            <PulsingDot />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const statusColor = (status) => {
  if (status === 'Active') return { backgroundColor: 'rgba(0,229,160,0.12)', borderColor: '#00E5A0' };
  if (status === 'Pipeline') return { backgroundColor: 'rgba(0,229,255,0.12)', borderColor: ACCENT };
  return { backgroundColor: 'rgba(140,140,150,0.12)', borderColor: '#8a8a94' };
};

// ==========================================
// 3. MAYA AI CONSOLE SCREEN (FIXED: no longer gets stuck)
// ==========================================
const MayaAgentConsoleScreen = ({ navigation }) => {
  const [messages, setMessages] = useState([
    { id: 'seed-1', text: 'Greetings Executive. Maya & Aether core online. Direct me to process lead records, query manifests, or schedule real-time reminders.', isBot: true }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const mayaEngine = useRef(new OperationalMayaEngine()).current;
  const idCounter = useRef(1);
  const listRef = useRef(null);

  const nextId = () => {
    idCounter.current += 1;
    return `${Date.now()}-${idCounter.current}`;
  };

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isTyping) return;

    setMessages(prev => [...prev, { id: nextId(), text: trimmed, isBot: false }]);
    setInputText('');
    setIsTyping(true);

    let responseText;
    try {
      responseText = await mayaEngine.parseAndExecute(trimmed);
    } catch (err) {
      responseText = 'Aether encountered an error processing that directive. Please try again.';
    }

    // Small delay purely for a natural typing feel — always resolves, never blocks future sends
    await new Promise(resolve => setTimeout(resolve, 500));

    setMessages(prev => [...prev, { id: nextId(), text: responseText, isBot: true }]);
    setIsTyping(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenHeader}>
        <IconButton onPress={() => navigation.openDrawer()} style={{ marginRight: 10 }}>
          <Menu size={20} color={ACCENT} />
        </IconButton>
        <Text style={styles.screenHeaderTitle}>Maya AI Advisory & Ops</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90} style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 18 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <FadeSlideIn style={[styles.msgBubble, item.isBot ? styles.botBubble : styles.userBubble]}>
              {item.isBot && <View style={styles.botAvatar}><Bot size={12} color={ACCENT} /></View>}
              <Text style={[styles.msgText, !item.isBot && styles.userMsgText]}>{item.text}</Text>
            </FadeSlideIn>
          )}
          ListFooterComponent={isTyping ? (
            <View style={[styles.msgBubble, styles.botBubble, { alignItems: 'center' }]}>
              <View style={styles.botAvatar}><Bot size={12} color={ACCENT} /></View>
              <TypingDots />
            </View>
          ) : null}
        />
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.chatInput}
            placeholder="Command Maya..."
            placeholderTextColor="#4a4a55"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!isTyping}
          />
          <AnimatedPressable style={[styles.sendButton, (isTyping || !inputText.trim()) && { opacity: 0.5 }]} onPress={handleSend} disabled={isTyping || !inputText.trim()}>
            <Send size={14} color="#09090b" />
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ==========================================
// 4. REPORTS VAULT SCREEN (fixed filenames + full data coverage)
// ==========================================
const sanitizeFileName = (title) =>
  title.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60);

const buildReportHtml = (reportTitle) => {
  const stats = GlobalDataStore.stats();
  const generatedDate = new Date().toLocaleDateString();

  const leadsRows = GlobalDataStore.leads.map(l => `
    <tr>
      <td>${l.name}</td><td>${l.vehicle}</td><td>$${l.deposit.toLocaleString()}</td>
      <td>${l.date}</td><td>${l.status}</td>
    </tr>`).join('');

  const shipmentRows = GlobalDataStore.shipments.map(s => `
    <tr>
      <td>${s.container}</td><td>${s.vessel}</td><td>${s.origin}</td>
      <td>${s.units}</td><td>${s.status}</td>
    </tr>`).join('');

  const financingRows = GlobalDataStore.financing.map(f => `
    <tr>
      <td>${f.partner}</td><td>$${f.limit.toLocaleString()}</td>
      <td>$${f.used.toLocaleString()}</td><td>${f.status}</td>
    </tr>`).join('');

  return `
    <html>
      <head>
        <style>
          body { font-family: Helvetica, Arial, sans-serif; padding: 32px; color: #14141a; }
          h1 { color: #0891a8; margin-bottom: 2px; }
          h2 { color: #14141a; font-size: 16px; margin-top: 4px; font-weight: 500; }
          h3 { margin-top: 30px; margin-bottom: 8px; border-bottom: 2px solid #00E5FF; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { text-align: left; background: #14141a; color: #fff; padding: 8px; font-size: 12px; }
          td { padding: 8px; font-size: 12px; border-bottom: 1px solid #eee; }
          .summary { display: flex; gap: 24px; margin-top: 16px; }
          .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; }
          .card .num { font-size: 20px; font-weight: 700; color: #0891a8; }
          .card .label { font-size: 11px; color: #666; }
          .footer { margin-top: 32px; font-size: 10px; color: #999; }
        </style>
      </head>
      <body>
        <h1>OGAMOTO Enterprise Report</h1>
        <h2>${reportTitle}</h2>
        <p style="color:#666; font-size: 12px;">Generated: ${generatedDate}</p>

        <div class="summary">
          <div class="card"><div class="num">$${stats.totalLeadValue.toLocaleString()}</div><div class="label">Total Lead Value</div></div>
          <div class="card"><div class="num">${GlobalDataStore.leads.length}</div><div class="label">Total Leads</div></div>
          <div class="card"><div class="num">${stats.totalUnits}</div><div class="label">Units In Transit</div></div>
        </div>

        <h3>Leads Pipeline</h3>
        <table>
          <tr><th>Name</th><th>Vehicle</th><th>Deposit</th><th>Date</th><th>Status</th></tr>
          ${leadsRows}
        </table>

        <h3>Cargo & Shipments</h3>
        <table>
          <tr><th>Container</th><th>Vessel</th><th>Origin</th><th>Units</th><th>Status</th></tr>
          ${shipmentRows}
        </table>

        <h3>Financing Partners</h3>
        <table>
          <tr><th>Partner</th><th>Limit</th><th>Used</th><th>Status</th></tr>
          ${financingRows}
        </table>

        <div class="footer">OGAMOTO Enterprise System — Confidential Executive Document</div>
      </body>
    </html>
  `;
};

const ReportsVaultScreen = ({ navigation }) => {
  const [generatingId, setGeneratingId] = useState(null);

  const generatePDFReport = async (report) => {
    setGeneratingId(report.id);
    try {
      const html = buildReportHtml(report.title);
      const { uri } = await Print.printToFileAsync({ html });

      // Give the exported file a proper, human-readable name instead of the
      // random temp name Print.printToFileAsync generates.
      const properName = `OGAMOTO_${sanitizeFileName(report.title)}_${new Date().toISOString().split('T')[0]}.pdf`;
      const destination = `${FileSystem.cacheDirectory}${properName}`;
      await FileSystem.copyAsync({ from: uri, to: destination });

      await Sharing.shareAsync(destination, { mimeType: 'application/pdf', dialogTitle: report.title, UTI: 'com.adobe.pdf' });
    } catch (e) {
      Alert.alert('Report Error', 'Could not generate or share the PDF document.');
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenHeader}>
        <IconButton onPress={() => navigation.openDrawer()} style={{ marginRight: 10 }}>
          <Menu size={20} color={ACCENT} />
        </IconButton>
        <Text style={styles.screenHeaderTitle}>Reports Vault</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18 }}>
        {GlobalDataStore.reports.map((item, i) => (
          <FadeSlideIn key={item.id} delay={i * 70} style={styles.reportCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <FileText size={22} color={ACCENT} style={{ marginRight: 14 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{item.title}</Text>
                <Text style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{item.date} · Full data export</Text>
              </View>
            </View>
            <AnimatedPressable style={styles.downloadBtn} onPress={() => generatePDFReport(item)} disabled={generatingId === item.id}>
              {generatingId === item.id ? <ActivityIndicator size="small" color="#09090b" /> : <Download size={15} color="#09090b" />}
            </AnimatedPressable>
          </FadeSlideIn>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

// Give reports table entries onto the store so ReportsVaultScreen can read them
GlobalDataStore.reports = [
  { id: 'REP-001', title: 'Q2 Executive Lead Audit', date: '2026-07-15' },
  { id: 'REP-002', title: 'Cargo & Logistics Manifest', date: '2026-07-28' },
];

// ==========================================
// 5. CRM WEBVIEW PORTAL SCREEN
// ==========================================
const CRMWebViewScreen = ({ navigation, route }) => {
  const targetUri = route.params?.uri || 'https://pap-crm.vercel.app/';
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenHeader}>
        <IconButton onPress={() => navigation.openDrawer()} style={{ marginRight: 10 }}>
          <Menu size={20} color={ACCENT} />
        </IconButton>
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
        <Bot size={28} color={ACCENT} />
        <Text style={styles.drawerBrandText}>OGAMOTO CRM</Text>
        <Text style={styles.drawerUserText}>John Doe (Admin)</Text>
      </View>
      <DrawerItemList {...props} />
      <DrawerItem
        label="Logout"
        icon={({ color }) => <LogOut size={17} color="#ff4d4d" />}
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
        drawerStyle: { backgroundColor: '#09090b', width: 270 },
        drawerActiveTintColor: ACCENT,
        drawerInactiveTintColor: '#8a8a94',
        drawerLabelStyle: { fontWeight: '600', fontSize: 13 },
        drawerType: 'slide',
        overlayColor: 'rgba(0,0,0,0.55)',
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
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="MainDrawer" component={MainDrawerNavigator} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

// ==========================================
// STYLESHEET (trimmed sizing, bigger touch targets)
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  screenHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a22', backgroundColor: '#09090b' },
  screenHeaderTitle: { color: ACCENT, fontWeight: '800', fontSize: 15, letterSpacing: 0.4 },

  iconButtonTarget: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  loginContainer: { flex: 1, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center' },
  loginGlow: { position: 'absolute', width: width * 1.4, height: width * 1.4, borderRadius: width * 0.7, backgroundColor: ACCENT, opacity: 0.06, top: -width * 0.6 },
  loginCard: { width: width * 0.85, padding: 24, backgroundColor: '#101014', borderRadius: 22, borderWidth: 1, borderColor: '#1a1a22' },
  brandBadge: { alignSelf: 'center', width: 46, height: 46, borderRadius: 14, backgroundColor: '#09090b', borderWidth: 1, borderColor: '#1a1a22', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  loginBrandText: { fontSize: 26, fontWeight: '900', color: ACCENT, textAlign: 'center', letterSpacing: 4 },
  loginTagline: { fontSize: 10, color: '#fff', opacity: 0.4, textAlign: 'center', letterSpacing: 2, marginBottom: 26, marginTop: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#09090b', borderWidth: 1, borderColor: '#1a1a22', borderRadius: 13, marginBottom: 14, paddingHorizontal: 14 },
  inputIcon: { marginRight: 10 },
  authInputField: { flex: 1, height: 46, color: '#fff', fontSize: 13 },
  loginSubmitButton: { backgroundColor: ACCENT, height: 48, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  loginSubmitButtonDisabled: { opacity: 0.7 },
  loginButtonText: { color: '#09090b', fontWeight: '800', fontSize: 12, letterSpacing: 1 },

  drawerHeader: { padding: 18, borderBottomWidth: 1, borderBottomColor: '#1a1a22', marginBottom: 8 },
  drawerBrandText: { color: ACCENT, fontWeight: '900', fontSize: 17, marginTop: 8 },
  drawerUserText: { color: '#666', fontSize: 11, marginTop: 2 },

  refreshBtn: { padding: 0, backgroundColor: '#101014', borderRadius: 12, borderWidth: 1, borderColor: '#1a1a22' },
  sectionHeading: { fontSize: 19, fontWeight: '800', color: '#fff' },
  sectionEyebrow: { fontSize: 10.5, color: '#666', marginTop: 2, fontWeight: '600' },
  sectionSubHeading: { fontSize: 11.5, fontWeight: '700', color: ACCENT, letterSpacing: 1 },
  filterNote: { color: '#666', fontSize: 10.5, marginBottom: 8, fontStyle: 'italic' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dashboardMetricItem: { backgroundColor: '#101014', width: '48%', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#1a1a22' },
  activeItemCard: { borderColor: ACCENT },
  metricIconWrap: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center' },
  metricIconWrapActive: { backgroundColor: 'rgba(0,229,255,0.1)' },
  dashboardMetricNumber: { fontSize: 19, fontWeight: '800', color: '#fff', marginTop: 10 },
  dashboardMetricLabel: { color: '#777', fontSize: 10.5, marginTop: 4, fontWeight: '600' },

  timeFilterContainer: { flexDirection: 'row', backgroundColor: '#101014', borderRadius: 8, padding: 2, borderWidth: 1, borderColor: '#1a1a22' },
  timeFilterBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  timeFilterBadgeActive: { backgroundColor: ACCENT },
  timeFilterText: { color: '#666', fontSize: 10, fontWeight: '700' },
  timeFilterTextActive: { color: '#09090b' },

  systemStatusLedgerAlertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101014', padding: 14, borderRadius: 13, borderWidth: 1, borderColor: '#1a1a22', marginTop: 10 },
  ledgerIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', marginRight: 12 },

  graphContainerCanvas: { backgroundColor: '#101014', padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#1a1a22', minHeight: 200, justifyContent: 'flex-end' },
  graphBarsAxisContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', width: '100%' },
  individualBarColumn: { alignItems: 'center' },
  interactiveChartBarLine: { width: 30, backgroundColor: ACCENT, borderRadius: 6 },
  barMarkerLabels: { color: '#666', fontSize: 9.5, marginTop: 9, fontWeight: '700' },
  barMarkerValueText: { color: '#fff', fontSize: 9.5, marginBottom: 6, fontWeight: '600' },
  emptyStateText: { color: '#555', fontSize: 12, textAlign: 'center', paddingVertical: 30 },

  statusRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statusChip: { backgroundColor: '#101014', width: '31%', paddingVertical: 14, borderRadius: 13, borderWidth: 1, borderColor: '#1a1a22', alignItems: 'center' },
  statusChipCount: { color: '#fff', fontWeight: '800', fontSize: 18 },
  statusChipLabel: { color: '#777', fontSize: 10, marginTop: 3, fontWeight: '600' },

  leadRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101014', padding: 13, borderRadius: 13, borderWidth: 1, borderColor: '#1a1a22', marginBottom: 8 },
  leadName: { color: '#fff', fontWeight: '700', fontSize: 12.5 },
  leadSub: { color: '#666', fontSize: 10.5, marginTop: 2 },
  leadDeposit: { color: ACCENT, fontWeight: '700', fontSize: 12, marginRight: 10 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },

  shipmentSummaryRow: { flexDirection: 'row', marginBottom: 10 },
  shipmentSummaryChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101014', borderWidth: 1, borderColor: '#1a1a22', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginRight: 10 },
  shipmentSummaryText: { color: '#ccc', fontSize: 11, marginLeft: 6, fontWeight: '600' },
  shipmentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101014', padding: 13, borderRadius: 13, borderWidth: 1, borderColor: '#1a1a22', marginBottom: 8 },
  shipmentStatusText: { color: ACCENT, fontSize: 10.5, fontWeight: '700' },

  msgBubble: { padding: 13, borderRadius: 17, marginVertical: 5, maxWidth: '85%', flexDirection: 'row', alignItems: 'flex-start' },
  botBubble: { backgroundColor: '#101014', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#1a1a22' },
  userBubble: { backgroundColor: ACCENT, alignSelf: 'flex-end' },
  botAvatar: { width: 19, height: 19, borderRadius: 6, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', marginRight: 8, marginTop: 1 },
  msgText: { color: '#eaeaea', fontSize: 12.5, lineHeight: 18, flexShrink: 1 },
  userMsgText: { color: '#09090b', fontWeight: '600' },

  inputContainer: { flexDirection: 'row', padding: 14, backgroundColor: '#09090b', borderTopWidth: 1, borderTopColor: '#1a1a22', alignItems: 'center' },
  chatInput: { flex: 1, backgroundColor: '#101014', color: '#fff', paddingHorizontal: 16, height: 46, borderRadius: 23, marginRight: 10, borderWidth: 1, borderColor: '#1a1a22' },
  sendButton: { backgroundColor: ACCENT, width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },

  reportCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#101014', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#1a1a22', marginBottom: 11 },
  downloadBtn: { backgroundColor: ACCENT, width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});
