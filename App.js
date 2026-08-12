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

// Expo Modules — Notifications & Sharing. PDF generation now lives entirely
// inside Aether.js (it owns expo-print + expo-file-system for reports), so
// App.js only needs Sharing to hand a finished PDF to the OS share sheet.
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';

// Vector Icons
import {
  Bot, Send, LogIn, LayoutDashboard, Globe,
  User, Lock, TrendingUp, Container, Layers, LogOut, Eye, EyeOff,
  Menu, FileText, Download, Anchor, Truck, Sliders, Settings, Plus, RefreshCw, Bell,
  CheckCircle2, Clock, PackageCheck, AlertTriangle,
} from 'lucide-react-native';

// ==========================================
// MAYA & AETHER — the two agents that do all the real work now.
// App.js no longer holds any mock data or business logic of its own: Maya
// handles conversation + intent, Aether handles every live DynamoDB read/
// write and PDF report generation. See src/agents/Maya.js and
// src/agents/Aether.js for the full implementation.
// ==========================================
import { MayaAgent } from '@/src/agents/Maya';
import { AetherAgent, ReportsVault } from '@/src/agents/Aether';

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

// One shared, stateless Aether instance for direct reads (Dashboard, Reports
// Vault) and one that lives inside Maya for conversational CRUD — both just
// call the same live AWS endpoint, so sharing is safe and there's nothing to
// keep in sync between them.
const sharedAether = new AetherAgent();

let __taskSeq = 0;
const nextTaskId = () => `APP-${Date.now()}-${__taskSeq++}`;

const toNum = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
};

const formatMoney = (v) => `$${toNum(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const formatChartValue = (v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`);

// Stable, deterministic accent color for an arbitrary status string — since
// real DynamoDB "stage" / "shipment_status" / "active_status" values aren't
// a fixed enum, we can't hardcode a palette per literal label.
const STATUS_PALETTE = [
  { backgroundColor: 'rgba(0,229,160,0.12)', borderColor: '#00E5A0' },
  { backgroundColor: 'rgba(0,229,255,0.12)', borderColor: ACCENT },
  { backgroundColor: 'rgba(255,184,0,0.12)', borderColor: '#FFB800' },
  { backgroundColor: 'rgba(255,90,90,0.12)', borderColor: '#FF5A5A' },
  { backgroundColor: 'rgba(140,140,150,0.12)', borderColor: '#8a8a94' },
];
const statusColor = (status) => {
  const s = String(status || 'Unspecified');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return STATUS_PALETTE[hash % STATUS_PALETTE.length];
};

// ==========================================
// DEVICE NOTIFICATION SCHEDULING
// Maya decides WHAT to remind the user about (it returns a plain
// { title, body, delaySeconds } request) — actually touching Expo's
// notification APIs is App.js's job, since Maya.js is intentionally
// platform-agnostic.
// ==========================================
async function ensureAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Maya Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: ACCENT,
    });
  }
}

async function requestNotificationPermission() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Returns true on success, or a user-facing error string on failure. */
async function scheduleDeviceNotification(delaySeconds, title, body) {
  const granted = await requestNotificationPermission();
  if (!granted) {
    return 'Notification permission is off. Enable alerts for OGAMOTO in your device Settings, then try again.';
  }
  await ensureAndroidChannel();
  const safeSeconds = Math.max(1, Math.round(delaySeconds || 60));
  await Notifications.scheduleNotificationAsync({
    content: { title: title || 'OGAMOTO Alert', body: body || 'Scheduled Maya action.', sound: true },
    trigger: {
      seconds: safeSeconds,
      repeats: false,
      ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
    },
  });
  return true;
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

// A small inline banner for non-fatal fetch errors, with a retry action.
const ErrorBanner = ({ message, onRetry }) => (
  <View style={styles.errorBanner}>
    <AlertTriangle size={16} color="#FF5A5A" style={{ marginRight: 10 }} />
    <Text style={styles.errorBannerText}>{message}</Text>
    {onRetry && (
      <AnimatedPressable onPress={onRetry} style={styles.errorBannerRetry}>
        <Text style={styles.errorBannerRetryText}>Retry</Text>
      </AnimatedPressable>
    )}
  </View>
);

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
// 2. DASHBOARD SCREEN — now backed entirely by live Aether reads
// ==========================================
const FILTER_DAYS = { '7D': 7, '30D': 30, 'YTD': null };

const DashboardScreen = ({ navigation }) => {
  const [activeDomain, setActiveDomain] = useState('LEADS');
  const [timeFilter, setTimeFilter] = useState('30D');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [leads, setLeads] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [financing, setFinancing] = useState([]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [leadsRes, shipmentsRes, financingRes] = await Promise.all([
        sharedAether.executeTask({ actionType: 'READ', entity: 'leads', payload: {}, taskId: nextTaskId() }),
        sharedAether.executeTask({ actionType: 'READ', entity: 'shipments', payload: {}, taskId: nextTaskId() }),
        sharedAether.executeTask({ actionType: 'READ', entity: 'financing', payload: {}, taskId: nextTaskId() }),
      ]);

      if (leadsRes.status === 'SUCCESS') setLeads(leadsRes.dataPayload || []);
      if (shipmentsRes.status === 'SUCCESS') setShipments(shipmentsRes.dataPayload || []);
      if (financingRes.status === 'SUCCESS') setFinancing(financingRes.dataPayload || []);

      const anyFailed = [leadsRes, shipmentsRes, financingRes].some(r => r.status !== 'SUCCESS');
      if (anyFailed) setError('Some live data failed to load. Pull to refresh to try again.');
    } catch (e) {
      setError('Could not reach the live system. Check your connection and pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetch every time this screen regains focus — e.g. right after Maya
  // creates or updates a record in the chat console.
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const filteredLeads = useMemo(() => {
    const now = new Date();
    return leads.filter(l => {
      if (!l.createdAt) return true; // don't silently hide records with no timestamp
      const d = new Date(l.createdAt);
      if (isNaN(d.getTime())) return true;
      if (timeFilter === 'YTD') return d.getFullYear() === now.getFullYear();
      const days = FILTER_DAYS[timeFilter];
      const diffDays = (now - d) / (1000 * 60 * 60 * 24);
      return diffDays <= days && diffDays >= -1;
    });
  }, [leads, timeFilter]);

  const totalLeadValuation = filteredLeads.reduce((sum, item) => sum + toNum(item.budget), 0);

  const statusBreakdown = filteredLeads.reduce((acc, l) => {
    const key = l.stage || 'Unspecified';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const statusKeys = Object.keys(statusBreakdown).slice(0, 3);

  const shipmentStatusBreakdown = shipments.reduce((acc, s) => {
    const key = s.shipment_status || 'Unspecified';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const shipmentStatusKeys = Object.keys(shipmentStatusBreakdown).slice(0, 2);

  const chartData = activeDomain === 'LEADS'
    ? filteredLeads.map(l => ({ key: l.lead_id, label: (l.name || 'Lead').split(' ')[0], value: toNum(l.budget) }))
    : shipments.map(s => ({ key: s.shipment_id, label: s.shipment_number || (s.vessel_name || 'Ship').split(' ')[0], value: toNum(s.total_logistics_cost) }));
  const chartMax = Math.max(1, ...chartData.map(d => d.value), 1);

  const onRefresh = () => loadData(true);

  const changeFilter = (range) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTimeFilter(range);
  };

  const changeDomain = (domain) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveDomain(domain);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={{ color: '#666', fontSize: 12, marginTop: 12 }}>Pulling live data from Aether…</Text>
      </SafeAreaView>
    );
  }

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

        {error && <ErrorBanner message={error} onRetry={() => loadData()} />}

        {/* Dynamic Metric Cards */}
        <View style={styles.statsRow}>
          <AnimatedPressable style={[styles.dashboardMetricItem, activeDomain === 'LEADS' && styles.activeItemCard]} onPress={() => changeDomain('LEADS')}>
            <View style={[styles.metricIconWrap, activeDomain === 'LEADS' && styles.metricIconWrapActive]}>
              <TrendingUp size={17} color={activeDomain === 'LEADS' ? ACCENT : '#666'} />
            </View>
            <Text style={styles.dashboardMetricNumber}>{formatMoney(totalLeadValuation)}</Text>
            <Text style={styles.dashboardMetricLabel}>Leads Value ({timeFilter})</Text>
          </AnimatedPressable>

          <AnimatedPressable style={[styles.dashboardMetricItem, activeDomain === 'SHIPMENTS' && styles.activeItemCard]} onPress={() => changeDomain('SHIPMENTS')}>
            <View style={[styles.metricIconWrap, activeDomain === 'SHIPMENTS' && styles.metricIconWrapActive]}>
              <Container size={17} color={activeDomain === 'SHIPMENTS' ? ACCENT : '#666'} />
            </View>
            <Text style={styles.dashboardMetricNumber}>{shipments.length}</Text>
            <Text style={styles.dashboardMetricLabel}>Total Shipments</Text>
          </AnimatedPressable>
        </View>

        {/* Time-Range Filter Bar */}
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
                const barHeight = Math.min(Math.max((item.value / chartMax) * 150, 20), 160);
                return (
                  <View key={item.key || index} style={styles.individualBarColumn}>
                    <Text style={styles.barMarkerValueText}>{formatChartValue(item.value)}</Text>
                    <AnimatedChartBar targetHeight={barHeight} delay={index * 80} />
                    <Text style={styles.barMarkerLabels}>{item.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Pipeline Status Breakdown — dynamic, since real "stage" values aren't a fixed enum */}
        <Text style={[styles.sectionSubHeading, { marginTop: 22, marginBottom: 10 }]}>Pipeline Status ({timeFilter})</Text>
        <View style={styles.statusRow}>
          {statusKeys.length === 0 ? (
            <Text style={styles.emptyStateText}>No leads recorded in this window.</Text>
          ) : statusKeys.map((s) => (
            <View key={s} style={styles.statusChip}>
              <Text style={styles.statusChipCount}>{statusBreakdown[s]}</Text>
              <Text style={styles.statusChipLabel} numberOfLines={1}>{s}</Text>
            </View>
          ))}
        </View>

        {/* Recent Leads List */}
        <Text style={[styles.sectionSubHeading, { marginTop: 22, marginBottom: 10 }]}>Recent Leads</Text>
        {filteredLeads.length === 0 ? (
          <Text style={styles.emptyStateText}>No leads recorded in this window.</Text>
        ) : filteredLeads.map((lead, i) => (
          <FadeSlideIn key={lead.lead_id} delay={i * 60} style={styles.leadRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.leadName}>{lead.name || 'Unnamed Lead'}</Text>
              <Text style={styles.leadSub}>{lead.preferredVehicle || 'No vehicle set'} · {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '—'}</Text>
            </View>
            <Text style={styles.leadDeposit}>{formatMoney(lead.budget)}</Text>
            <View style={[styles.statusBadge, statusColor(lead.stage)]}>
              <Text style={styles.statusBadgeText}>{lead.stage || 'Unspecified'}</Text>
            </View>
          </FadeSlideIn>
        ))}

        {/* Shipments Snapshot */}
        <Text style={[styles.sectionSubHeading, { marginTop: 22, marginBottom: 10 }]}>Cargo & Logistics</Text>
        <View style={styles.shipmentSummaryRow}>
          {shipmentStatusKeys.length === 0 ? (
            <Text style={styles.filterNote}>No shipments on file yet.</Text>
          ) : shipmentStatusKeys.map((s) => (
            <View key={s} style={styles.shipmentSummaryChip}>
              <Clock size={14} color={ACCENT} />
              <Text style={styles.shipmentSummaryText} numberOfLines={1}>{shipmentStatusBreakdown[s]} {s}</Text>
            </View>
          ))}
        </View>
        {shipments.map((s, i) => (
          <FadeSlideIn key={s.shipment_id} delay={i * 60} style={styles.shipmentRow}>
            <Container size={16} color="#8a8a94" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.leadName}>{s.shipment_number || 'Shipment'} · {s.vessel_name || 'Unassigned vessel'}</Text>
              <Text style={styles.leadSub}>{s.origin_location || '—'} → {s.destination_country || '—'}</Text>
            </View>
            <Text style={styles.shipmentStatusText}>{s.shipment_status || 'Unspecified'}</Text>
          </FadeSlideIn>
        ))}

        {/* Partner Ledger */}
        <Text style={[styles.sectionSubHeading, { marginTop: 22, marginBottom: 10 }]}>Financing Partner Ledger</Text>
        {financing.length === 0 ? (
          <Text style={styles.emptyStateText}>No financing partners on file yet.</Text>
        ) : financing.map((f) => (
          <View key={f.financing_id} style={styles.systemStatusLedgerAlertBox}>
            <View style={styles.ledgerIconWrap}><Layers size={17} color={ACCENT} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{f.partner_name || 'Unnamed Partner'}</Text>
              <Text style={{ color: '#8a8a94', fontSize: 11, marginTop: 3 }}>
                Limit: {formatMoney(f.max_loan_amount)} · Rate: {f.interest_rate ? `${f.interest_rate}%` : '—'} · {f.active_status || 'Unspecified'}
              </Text>
            </View>
            <PulsingDot />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

// ==========================================
// 3. MAYA AI CONSOLE SCREEN — now a real MayaAgent, not a local mock engine
// ==========================================
const MayaAgentConsoleScreen = ({ navigation }) => {
  const [messages, setMessages] = useState([
    { id: 'seed-1', text: 'Greetings Executive. Maya & Aether core online. Direct me to process lead records, query manifests, schedule real-time reminders, or generate a report.', isBot: true }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const maya = useRef(new MayaAgent()).current;
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
      const result = await maya.handleUserDirective(trimmed);
      responseText = result.advice;

      // Maya only decides WHAT to remind the user about — App.js actually
      // schedules it on-device and surfaces a permission error if needed.
      if (result.notificationRequest) {
        const { title, body, delaySeconds } = result.notificationRequest;
        const outcome = await scheduleDeviceNotification(delaySeconds, title, body);
        if (outcome !== true) responseText = outcome;
      }
    } catch (err) {
      responseText = 'Aether hit a snag reaching the live system. Please try again in a moment.';
    }

    // Small delay purely for a natural typing feel — always resolves, never blocks future sends
    await new Promise(resolve => setTimeout(resolve, 450));

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
// 4. REPORTS VAULT SCREEN — reads live from Aether's ReportsVault registry
// ==========================================
const ReportsVaultScreen = ({ navigation }) => {
  const [entries, setEntries] = useState(ReportsVault.list());
  const [generating, setGenerating] = useState(false);
  const [sharingId, setSharingId] = useState(null);

  useEffect(() => {
    const unsubscribe = ReportsVault.subscribe((list) => setEntries([...list]));
    return unsubscribe;
  }, []);

  const generateFullReport = async () => {
    setGenerating(true);
    try {
      const result = await sharedAether.executeTask({
        actionType: 'GENERATE_PDF',
        payload: { fullExport: true, title: `Full Data Export — ${new Date().toLocaleDateString()}` },
        taskId: nextTaskId(),
      });
      if (result.status !== 'SUCCESS') {
        Alert.alert('Report Error', result.errorMessage || 'Could not generate the report.');
      }
    } catch (e) {
      Alert.alert('Report Error', 'Could not reach the live system to generate this report.');
    } finally {
      setGenerating(false);
    }
  };

  const shareReport = async (entry) => {
    setSharingId(entry.id);
    try {
      await Sharing.shareAsync(entry.filePath, { mimeType: 'application/pdf', dialogTitle: entry.title, UTI: 'com.adobe.pdf' });
    } catch (e) {
      Alert.alert('Share Error', 'Could not open the share sheet for this report.');
    } finally {
      setSharingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenHeader}>
        <IconButton onPress={() => navigation.openDrawer()} style={{ marginRight: 10 }}>
          <Menu size={20} color={ACCENT} />
        </IconButton>
        <Text style={styles.screenHeaderTitle}>Reports Vault</Text>
        <View style={{ flex: 1 }} />
        <AnimatedPressable style={styles.generateReportBtn} onPress={generateFullReport} disabled={generating}>
          {generating ? <ActivityIndicator size="small" color="#09090b" /> : <Plus size={16} color="#09090b" />}
        </AnimatedPressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18 }}>
        {entries.length === 0 ? (
          <Text style={styles.emptyStateText}>No reports yet. Ask Maya to generate one in the chat console, or tap + above for a full export.</Text>
        ) : entries.map((item, i) => (
          <FadeSlideIn key={item.id} delay={i * 70} style={styles.reportCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <FileText size={22} color={ACCENT} style={{ marginRight: 14 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{item.title}</Text>
                <Text style={{ color: '#666', fontSize: 11, marginTop: 2 }}>
                  {new Date(item.generatedAt).toLocaleDateString()} · {item.recordCount} record(s)
                </Text>
              </View>
            </View>
            <AnimatedPressable style={styles.downloadBtn} onPress={() => shareReport(item)} disabled={sharingId === item.id}>
              {sharingId === item.id ? <ActivityIndicator size="small" color="#09090b" /> : <Download size={15} color="#09090b" />}
            </AnimatedPressable>
          </FadeSlideIn>
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
// STYLESHEET
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

  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,90,90,0.08)', borderWidth: 1, borderColor: 'rgba(255,90,90,0.35)', borderRadius: 12, padding: 12, marginBottom: 16 },
  errorBannerText: { color: '#ffb3b3', fontSize: 11, flex: 1 },
  errorBannerRetry: { backgroundColor: 'rgba(255,90,90,0.18)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginLeft: 8 },
  errorBannerRetryText: { color: '#ff8080', fontSize: 10.5, fontWeight: '700' },

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
  statusChipLabel: { color: '#777', fontSize: 10, marginTop: 3, fontWeight: '600', paddingHorizontal: 4 },

  leadRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101014', padding: 13, borderRadius: 13, borderWidth: 1, borderColor: '#1a1a22', marginBottom: 8 },
  leadName: { color: '#fff', fontWeight: '700', fontSize: 12.5 },
  leadSub: { color: '#666', fontSize: 10.5, marginTop: 2 },
  leadDeposit: { color: ACCENT, fontWeight: '700', fontSize: 12, marginRight: 10 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },

  shipmentSummaryRow: { flexDirection: 'row', marginBottom: 10, flexWrap: 'wrap' },
  shipmentSummaryChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101014', borderWidth: 1, borderColor: '#1a1a22', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginRight: 10, marginBottom: 6 },
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
  generateReportBtn: { backgroundColor: ACCENT, width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
