import 'react-native-gesture-handler';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Modal,
  Dimensions, FlatList, KeyboardAvoidingView, Platform, Alert, ScrollView,
  SafeAreaView, ActivityIndicator, Animated, Easing, LayoutAnimation, UIManager,
  RefreshControl,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, useFocusEffect, DrawerActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Expo Modules — Notifications & Sharing
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';

// Vector Icons
import {
  Bot, Send, LogIn, Home, User, Lock, TrendingUp, Container, Layers, LogOut,
  Eye, EyeOff, Menu, FileText, Download, Anchor, Truck, Sliders, Settings,
  Plus, RefreshCw, Clock, AlertTriangle, ChevronRight, Search, X,
} from 'lucide-react-native';

import { MayaAgent } from './src/agents/Maya';
import { AetherAgent, ReportsVault } from './src/agents/Aether';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
const Tab = createBottomTabNavigator();
const ACCENT = '#00E5FF';
const DANGER = '#FF5A5A';
const BUILD_STAMP = 'build 2026-08-14.2';

const sharedAether = new AetherAgent();

let __taskSeq = 0;
const nextTaskId = () => `APP-${Date.now()}-${__taskSeq++}`;

const toNum = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
};

const formatCompactMoney = (v) => {
  const n = toNum(v);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

const formatFullMoney = (v) => `$${toNum(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const formatDetailValue = (value, type) => {
  if (value === undefined || value === null || value === '') return '—';
  if (type === 'money') return formatFullMoney(value);
  if (type === 'percent') return `${value}%`;
  if (type === 'date') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const buildDetailFields = (record, config) =>
  config.detailFields.map(([label, key, type]) => [label, formatDetailValue(record[key], type)]);

const STATUS_PALETTE = [
  { backgroundColor: 'rgba(0,229,160,0.12)', borderColor: '#00E5A0' },
  { backgroundColor: 'rgba(0,229,255,0.12)', borderColor: ACCENT },
  { backgroundColor: 'rgba(255,184,0,0.12)', borderColor: '#FFB800' },
  { backgroundColor: 'rgba(255,90,90,0.12)', borderColor: DANGER },
  { backgroundColor: 'rgba(140,140,150,0.12)', borderColor: '#8a8a94' },
];
const statusColor = (status) => {
  const s = String(status || 'Unspecified');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return STATUS_PALETTE[hash % STATUS_PALETTE.length];
};

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

const AnimatedPressable = ({ onPress, style, children, disabled, hitSlop, leakColor = ACCENT }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const leak = useRef(new Animated.Value(0)).current;

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
    leak.stopAnimation();
    leak.setValue(0);
    Animated.timing(leak, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 8 }).start();
    Animated.timing(leak, { toValue: 0, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      hitSlop={hitSlop || { top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={[style, { transform: [{ scale }], overflow: 'hidden' }]}>
        {children}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: leakColor,
              opacity: leak.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }),
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const IconButton = ({ onPress, children, style, leakColor }) => (
  <AnimatedPressable
    onPress={onPress}
    leakColor={leakColor}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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

const ErrorBanner = ({ message, onRetry }) => (
  <View style={styles.errorBanner}>
    <AlertTriangle size={16} color={DANGER} style={{ marginRight: 10 }} />
    <Text style={styles.errorBannerText}>{message}</Text>
    {onRetry && (
      <AnimatedPressable onPress={onRetry} style={styles.errorBannerRetry} leakColor={DANGER}>
        <Text style={styles.errorBannerRetryText}>Retry</Text>
      </AnimatedPressable>
    )}
  </View>
);

const ScreenHeader = ({ navigation, title, right }) => (
  <View style={styles.screenHeader}>
    <IconButton onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={{ marginRight: 10 }}>
      <Menu size={20} color={ACCENT} />
    </IconButton>
    <Text style={styles.screenHeaderTitle} numberOfLines={1}>{title}</Text>
    <View style={{ flex: 1 }} />
    {right}
  </View>
);

const DetailModal = ({ visible, onClose, title, subtitle, icon: Icon, fields = [] }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <View style={styles.modalHeaderRow}>
          {Icon && <View style={styles.modalIconWrap}><Icon size={18} color={ACCENT} /></View>}
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle} numberOfLines={1}>{title || 'Record Detail'}</Text>
            {!!subtitle && <Text style={styles.modalSubtitle} numberOfLines={1}>{subtitle}</Text>}
          </View>
          <IconButton onPress={onClose} style={styles.modalCloseBtn}>
            <X size={16} color="#999" />
          </IconButton>
        </View>
        <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ paddingBottom: 14 }}>
          {fields.map(([label, value]) => (
            <View key={label} style={styles.modalFieldRow}>
              <Text style={styles.modalFieldLabel}>{label}</Text>
              <Text style={styles.modalFieldValue} numberOfLines={3}>{value}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

const BrandLoadingOverlay = ({ label = 'Initializing OGAMOTO CRM…' }) => {
  const pulse = useRef(new Animated.Value(0.92)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.92, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.timing(progress, { toValue: 1, duration: 950, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={[styles.brandLoaderOverlay, { opacity: fade }]}>
      <View style={styles.brandLoaderRingWrap}>
        <Animated.View style={[styles.brandLoaderRing, { transform: [{ rotate: spin }] }]} />
        <Animated.View style={[styles.brandLoaderBadge, { transform: [{ scale: pulse }] }]}>
          <Bot size={26} color={ACCENT} />
        </Animated.View>
      </View>
      <Text style={styles.brandLoaderText}>{label}</Text>
      <View style={styles.brandLoaderTrack}>
        <Animated.View style={[styles.brandLoaderFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
    </Animated.View>
  );
};

// 1. LOGIN SCREEN
const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('john@gmail.com');
  const [password, setPassword] = useState('abcd1234');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const badgePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(badgePulse, { toValue: 1.06, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(badgePulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const handleLogin = () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Authentication Error', 'Please enter valid credentials.');
      return;
    }
    setIsLoggingIn(true);
  };

  useEffect(() => {
    if (!isLoggingIn) return;
    const t = setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: 'MainDrawer' }] });
    }, 950);
    return () => clearTimeout(t);
  }, [isLoggingIn]);

  return (
    <SafeAreaView style={styles.loginContainer}>
      <View style={styles.loginGlow} />
      <View style={styles.loginGlowSecondary} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
        <FadeSlideIn style={styles.loginCard}>
          <Animated.View style={[styles.brandBadge, { transform: [{ scale: badgePulse }] }]}>
            <Bot size={22} color={ACCENT} />
          </Animated.View>
          <Text style={styles.loginBrandText}>OGAMOTO CRM</Text>
          <Text style={styles.loginTagline}>ENTERPRISE INTELLIGENCE PLATFORM</Text>

          <FadeSlideIn delay={90} style={styles.inputWrapper}>
            <User size={15} color={ACCENT} style={styles.inputIcon} />
            <TextInput style={styles.authInputField} placeholder="Admin Identifier" placeholderTextColor="#4a4a55" value={username} onChangeText={setUsername} autoCapitalize="none" />
          </FadeSlideIn>

          <FadeSlideIn delay={160} style={styles.inputWrapper}>
            <Lock size={15} color={ACCENT} style={styles.inputIcon} />
            <TextInput style={styles.authInputField} placeholder="Access Key" placeholderTextColor="#4a4a55" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} autoCapitalize="none" />
            <IconButton onPress={() => setShowPassword(v => !v)} style={{ paddingHorizontal: 4, width: 34, height: 34 }}>
              {showPassword ? <EyeOff size={16} color="#555" /> : <Eye size={16} color="#555" />}
            </IconButton>
          </FadeSlideIn>

          <FadeSlideIn delay={230}>
            <AnimatedPressable style={[styles.loginSubmitButton, isLoggingIn && styles.loginSubmitButtonDisabled]} onPress={handleLogin} disabled={isLoggingIn}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <LogIn size={15} color="#09090b" style={{ marginRight: 8 }} />
                <Text style={styles.loginButtonText}>INITIALIZE INTERFACE</Text>
              </View>
            </AnimatedPressable>
          </FadeSlideIn>
        </FadeSlideIn>
        <Text style={styles.buildStampText}>{BUILD_STAMP}</Text>
      </KeyboardAvoidingView>

      {isLoggingIn && <BrandLoadingOverlay label="Signing into OGAMOTO CRM…" />}
    </SafeAreaView>
  );
};

// 2. DASHBOARD SCREEN
const FILTER_DAYS = { '7D': 7, '30D': 30, 'YTD': null };

const DashboardScreen = ({ navigation }) => {
  const [activeDomain, setActiveDomain] = useState('LEADS');
  const [timeFilter, setTimeFilter] = useState('30D');
  const [selectedStage, setSelectedStage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);

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

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const filteredLeads = useMemo(() => {
    const now = new Date();
    return leads.filter(l => {
      if (!l.createdAt) return true;
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
  const statusKeys = Object.keys(statusBreakdown).slice(0, 4);

  const visibleLeads = selectedStage
    ? filteredLeads.filter(l => (l.stage || 'Unspecified') === selectedStage)
    : filteredLeads;

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

  const toggleStage = (s) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedStage(prev => (prev === s ? null : s));
  };

  const openLeadDetail = (lead) => setDetail({
    title: lead.name || 'Unnamed Lead', subtitle: lead.stage || 'Unspecified', icon: TrendingUp,
    fields: buildDetailFields(lead, ENTITY_UI.leads),
  });
  const openShipmentDetail = (s) => setDetail({
    title: s.shipment_number || 'Shipment', subtitle: s.shipment_status || 'Unspecified', icon: Container,
    fields: buildDetailFields(s, ENTITY_UI.shipments),
  });
  const openFinancingDetail = (f) => setDetail({
    title: f.partner_name || 'Financing Partner', subtitle: f.active_status || 'Unspecified', icon: Layers,
    fields: buildDetailFields(f, ENTITY_UI.financing),
  });

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
        contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
            <IconButton onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={{ marginRight: 10 }}>
              <Menu size={22} color={ACCENT} />
            </IconButton>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.brandMicroLabel}>OGAMOTO CRM</Text>
              <Text style={styles.greetingText} numberOfLines={1}>Hello Admin, I'm live.</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                <PulsingDot color="#00E5A0" size={7} />
                <Text style={styles.liveSubText}>  Connected to Aether · {new Date().toLocaleDateString()}</Text>
              </View>
            </View>
          </View>
          <IconButton onPress={onRefresh} style={styles.refreshBtn}>
            {refreshing ? <ActivityIndicator size="small" color={ACCENT} /> : <RefreshCw size={16} color={ACCENT} />}
          </IconButton>
        </View>

        {error && <ErrorBanner message={error} onRetry={() => loadData()} />}

        <View style={styles.statsRow}>
          <AnimatedPressable style={[styles.dashboardMetricItem, activeDomain === 'LEADS' && styles.activeItemCard]} onPress={() => changeDomain('LEADS')}>
            <View style={[styles.metricIconWrap, activeDomain === 'LEADS' && styles.metricIconWrapActive]}>
              <TrendingUp size={17} color={activeDomain === 'LEADS' ? ACCENT : '#666'} />
            </View>
            <View style={{ marginTop: 8 }}>
              <Text style={styles.dashboardMetricNumber} numberOfLines={1} adjustsFontSizeToFit>{formatCompactMoney(totalLeadValuation)}</Text>
              <Text style={styles.dashboardMetricLabel} numberOfLines={2}>Leads Value ({timeFilter})</Text>
            </View>
          </AnimatedPressable>

          <AnimatedPressable style={[styles.dashboardMetricItem, activeDomain === 'SHIPMENTS' && styles.activeItemCard]} onPress={() => changeDomain('SHIPMENTS')}>
            <View style={[styles.metricIconWrap, activeDomain === 'SHIPMENTS' && styles.metricIconWrapActive]}>
              <Container size={17} color={activeDomain === 'SHIPMENTS' ? ACCENT : '#666'} />
            </View>
            <View style={{ marginTop: 8 }}>
              <Text style={styles.dashboardMetricNumber} numberOfLines={1} adjustsFontSizeToFit>{shipments.length}</Text>
              <Text style={styles.dashboardMetricLabel} numberOfLines={2}>Total Shipments</Text>
            </View>
          </AnimatedPressable>
        </View>

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

        <View style={styles.graphContainerCanvas}>
          {chartData.length === 0 ? (
            <Text style={styles.emptyStateText}>No {activeDomain.toLowerCase()} in this range.</Text>
          ) : (
            <View style={styles.graphBarsAxisContainer}>
              {chartData.map((item, index) => {
                const barHeight = Math.min(Math.max((item.value / chartMax) * 140, 20), 140);
                return (
                  <View key={item.key || index} style={styles.individualBarColumn}>
                    <Text style={styles.barMarkerValueText}>{formatCompactMoney(item.value)}</Text>
                    <AnimatedChartBar targetHeight={barHeight} delay={index * 80} />
                    <Text style={styles.barMarkerLabels} numberOfLines={1}>{item.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <Text style={[styles.sectionSubHeading, { marginTop: 22, marginBottom: 10 }]}>Pipeline Status ({timeFilter}) · Tap to filter</Text>
        <View style={styles.statusRow}>
          {statusKeys.length === 0 ? (
            <Text style={styles.emptyStateText}>No leads recorded in this window.</Text>
          ) : statusKeys.map((s) => (
            <AnimatedPressable
              key={s}
              onPress={() => toggleStage(s)}
              style={[styles.statusChip, selectedStage === s && styles.statusChipActive]}
            >
              <Text style={styles.statusChipCount}>{statusBreakdown[s]}</Text>
              <Text style={styles.statusChipLabel} numberOfLines={1}>{s}</Text>
            </AnimatedPressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }}>
          <Text style={styles.sectionSubHeading}>Recent Leads{selectedStage ? ` · ${selectedStage}` : ''}</Text>
          {selectedStage && (
            <AnimatedPressable onPress={() => setSelectedStage(null)}>
              <Text style={styles.clearFilterText}>Clear</Text>
            </AnimatedPressable>
          )}
        </View>
        {visibleLeads.length === 0 ? (
          <Text style={styles.emptyStateText}>No leads match this view.</Text>
        ) : visibleLeads.map((lead, i) => (
          <FadeSlideIn key={lead.lead_id} delay={Math.min(i, 8) * 50} style={styles.leadRow}>
            <TouchableOpacity activeOpacity={0.8} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => openLeadDetail(lead)}>
              <View style={{ flex: 1, paddingRight: 6 }}>
                <Text style={styles.leadName} numberOfLines={1}>{lead.name || 'Unnamed Lead'}</Text>
                <Text style={styles.leadSub} numberOfLines={1}>{lead.preferredVehicle || 'No vehicle set'} · {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '—'}</Text>
              </View>
              <Text style={styles.leadDeposit}>{formatCompactMoney(lead.budget)}</Text>
              <View style={[styles.statusBadge, statusColor(lead.stage)]}>
                <Text style={styles.statusBadgeText} numberOfLines={1}>{lead.stage || 'Unspecified'}</Text>
              </View>
              <ChevronRight size={15} color="#3a3a44" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </FadeSlideIn>
        ))}

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
          <FadeSlideIn key={s.shipment_id} delay={Math.min(i, 8) * 50} style={styles.shipmentRow}>
            <TouchableOpacity activeOpacity={0.8} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => openShipmentDetail(s)}>
              <Container size={16} color="#8a8a94" style={{ marginRight: 10 }} />
              <View style={{ flex: 1, paddingRight: 6 }}>
                <Text style={styles.leadName} numberOfLines={1}>{s.shipment_number || 'Shipment'} · {s.vessel_name || 'Unassigned vessel'}</Text>
                <Text style={styles.leadSub} numberOfLines={1}>{s.origin_location || '—'} → {s.destination_country || '—'}</Text>
              </View>
              <Text style={styles.shipmentStatusText}>{s.shipment_status || 'Unspecified'}</Text>
              <ChevronRight size={15} color="#3a3a44" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </FadeSlideIn>
        ))}

        <Text style={[styles.sectionSubHeading, { marginTop: 22, marginBottom: 10 }]}>Financing Partner Ledger</Text>
        {financing.length === 0 ? (
          <Text style={styles.emptyStateText}>No financing partners on file yet.</Text>
        ) : financing.map((f) => (
          <TouchableOpacity key={f.financing_id} activeOpacity={0.8} style={styles.systemStatusLedgerAlertBox} onPress={() => openFinancingDetail(f)}>
            <View style={styles.ledgerIconWrap}><Layers size={17} color={ACCENT} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{f.partner_name || 'Unnamed Partner'}</Text>
              <Text style={{ color: '#8a8a94', fontSize: 11, marginTop: 3 }} numberOfLines={1}>
                Limit: {formatCompactMoney(f.max_loan_amount)} · Rate: {f.interest_rate ? `${f.interest_rate}%` : '—'} · {f.active_status || 'Unspecified'}
              </Text>
            </View>
            <PulsingDot />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <DetailModal
        visible={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title}
        subtitle={detail?.subtitle}
        icon={detail?.icon}
        fields={detail?.fields || []}
      />
    </SafeAreaView>
  );
};

// 3. MAYA AI CONSOLE SCREEN
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

      if (result.notificationRequest) {
        const { title, body, delaySeconds } = result.notificationRequest;
        const outcome = await scheduleDeviceNotification(delaySeconds, title, body);
        if (outcome !== true) responseText = outcome;
      }
    } catch (err) {
      responseText = 'Aether hit a snag reaching the live system. Please try again in a moment.';
    }

    await new Promise(resolve => setTimeout(resolve, 450));

    setMessages(prev => [...prev, { id: nextId(), text: responseText, isBot: true }]);
    setIsTyping(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader navigation={navigation} title="Maya AI Advisory & Ops" />

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

// 4. REPORTS VAULT SCREEN
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
      <ScreenHeader
        navigation={navigation}
        title="Reports Vault"
        right={
          <AnimatedPressable style={styles.generateReportBtn} onPress={generateFullReport} disabled={generating}>
            {generating ? <ActivityIndicator size="small" color="#09090b" /> : <Plus size={16} color="#09090b" />}
          </AnimatedPressable>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 18 }}>
        {entries.length === 0 ? (
          <Text style={styles.emptyStateText}>No reports yet. Ask Maya to generate one in the chat console, or tap + above for a full export.</Text>
        ) : entries.map((item, i) => (
          <FadeSlideIn key={item.id} delay={i * 70} style={styles.reportCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <FileText size={22} color={ACCENT} style={{ marginRight: 14 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }} numberOfLines={2}>{item.title}</Text>
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

// ENTITY UI CONFIG
const ENTITY_UI = {
  leads: {
    title: 'Leads Pipeline', icon: TrendingUp,
    idField: 'lead_id', titleField: 'name', statusField: 'stage', amountField: 'budget',
    subtitleFields: ['preferredVehicle', 'location'],
    searchFields: ['name', 'email', 'phone', 'location', 'preferredVehicle'],
    detailFields: [
      ['Name', 'name'], ['Stage', 'stage'], ['Budget', 'budget', 'money'], ['Down Payment', 'downPayment', 'money'],
      ['Assigned Rep', 'assignedRep'], ['Credit Status', 'creditStatus'], ['Preferred Vehicle', 'preferredVehicle'],
      ['Location', 'location'], ['Email', 'email'], ['Phone', 'phone'], ['Timeline', 'timeline'],
      ['Created', 'createdAt', 'date'], ['Last Activity', 'lastActivity', 'date'],
    ],
  },
  shipments: {
    title: 'Shipments', icon: Container,
    idField: 'shipment_id', titleField: 'shipment_number', statusField: 'shipment_status', amountField: 'total_logistics_cost',
    subtitleFields: ['vessel_name', 'destination_country'],
    searchFields: ['shipment_number', 'vessel_name', 'origin_location', 'destination_country', 'shipping_line'],
    detailFields: [
      ['Shipment #', 'shipment_number'], ['Status', 'shipment_status'], ['Vessel', 'vessel_name'], ['Shipping Line', 'shipping_line'],
      ['Origin', 'origin_location'], ['Destination', 'destination_country'], ['Port Used', 'port_used'], ['Actual Port', 'actual_port_used'],
      ['Departure', 'departure_date', 'date'], ['Arrival', 'arrival_date', 'date'], ['Est. Transit (days)', 'estimated_transit_time'],
      ['Ocean Freight', 'ocean_freight_cost', 'money'], ['Inland Transport', 'inland_transport_cost', 'money'], ['Total Cost', 'total_logistics_cost', 'money'],
      ['Vehicle ID', 'vehicle_id'], ['Linked Lead', 'lead_id'],
    ],
  },
  financing: {
    title: 'Financing Partners', icon: Layers,
    idField: 'financing_id', titleField: 'partner_name', statusField: 'active_status', amountField: 'max_loan_amount',
    subtitleFields: ['partner_type', 'contact_email'],
    searchFields: ['partner_name', 'partner_type', 'contact_email'],
    detailFields: [
      ['Partner', 'partner_name'], ['Status', 'active_status'], ['Type', 'partner_type'], ['Max Loan Amount', 'max_loan_amount', 'money'],
      ['Interest Rate', 'interest_rate', 'percent'], ['Loan Term (months)', 'loan_term_months'], ['Processing Fee', 'processing_fee', 'money'],
      ['Min Credit Score', 'min_credit_score'], ['Approval Time (days)', 'approval_time_days'], ['Supported Countries', 'supported_countries'],
      ['Contact Email', 'contact_email'], ['Notes', 'notes'],
    ],
  },
  logistics: {
    title: 'Logistics', icon: Truck,
    idField: 'logistics_id', titleField: 'tracking_number', statusField: 'logistics_status', amountField: 'total_logistics_cost',
    subtitleFields: ['shipment_id', 'vehicle_id'],
    searchFields: ['tracking_number', 'shipment_id'],
    detailFields: [
      ['Tracking #', 'tracking_number'], ['Status', 'logistics_status'], ['Shipment ID', 'shipment_id'], ['Lead ID', 'lead_id'], ['Vehicle ID', 'vehicle_id'],
      ['Ocean Freight', 'ocean_freight_cost', 'money'], ['Inland Transport', 'inland_transport_cost', 'money'], ['Insurance', 'insurance_cost', 'money'],
      ['Clearance Cost', 'clearance_cost', 'money'], ['Other Fees', 'other_fees', 'money'], ['Total Cost', 'total_logistics_cost', 'money'],
      ['Est. Transit (days)', 'estimated_transit_time'], ['Actual Transit (days)', 'actual_transit_time'], ['Last Updated', 'last_updated', 'date'],
    ],
  },
  ports: {
    title: 'Ports', icon: Anchor,
    idField: 'port_id', titleField: 'port_name', statusField: 'active_status', amountField: null,
    subtitleFields: ['city', 'country'],
    searchFields: ['port_name', 'port_code', 'city', 'country'],
    detailFields: [
      ['Port Name', 'port_name'], ['Status', 'active_status'], ['Port Code', 'port_code'], ['City', 'city'], ['State', 'state'], ['Country', 'country'],
      ['Shipping Partner', 'shipping_partner'], ['Container Supported', 'container_supported'], ['RoRo Supported', 'roro_supported'],
      ['Supported Destinations', 'supported_destination_countries'],
    ],
  },
};

// 5. GENERIC ENTITY LIST SCREEN
const EntityListScreen = ({ navigation, entityKey, config }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await sharedAether.executeTask({ actionType: 'READ', entity: entityKey, payload: {}, taskId: nextTaskId() });
      if (res.status === 'SUCCESS') setItems(res.dataPayload || []);
      else setError(res.errorMessage || 'Could not load live data.');
    } catch (e) {
      setError('Could not reach the live system. Pull to refresh to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [entityKey]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const statusBreakdown = items.reduce((acc, it) => {
    const key = it[config.statusField] || 'Unspecified';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const statusKeys = Object.keys(statusBreakdown);

  const filtered = items.filter((it) => {
    if (statusFilter && (it[config.statusField] || 'Unspecified') !== statusFilter) return false;
    if (!search.trim()) return true;
    const needle = search.trim().toLowerCase();
    return config.searchFields.some((f) => String(it[f] || '').toLowerCase().includes(needle));
  });

  const openDetail = (item) => setDetail({
    title: item[config.titleField] || config.title,
    subtitle: item[config.statusField] || 'Unspecified',
    icon: config.icon,
    fields: buildDetailFields(item, config),
  });

  const onRefresh = () => load(true);
  const Icon = config.icon;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader navigation={navigation} title={config.title} />

      <View style={styles.searchBarWrap}>
        <Search size={15} color="#666" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${config.title.toLowerCase()}...`}
          placeholderTextColor="#4a4a55"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <IconButton onPress={() => setSearch('')} style={{ width: 30, height: 30 }}>
            <X size={14} color="#666" />
          </IconButton>
        )}
      </View>

      {statusKeys.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
          <AnimatedPressable onPress={() => setStatusFilter(null)} style={[styles.filterChip, !statusFilter && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, !statusFilter && styles.filterChipTextActive]}>All ({items.length})</Text>
          </AnimatedPressable>
          {statusKeys.map((s) => (
            <AnimatedPressable key={s} onPress={() => setStatusFilter(statusFilter === s ? null : s)} style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]} numberOfLines={1}>{s} ({statusBreakdown[s]})</Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      )}

      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingTop: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />}
        >
          {error && <ErrorBanner message={error} onRetry={() => load()} />}
          {filtered.length === 0 ? (
            <Text style={styles.emptyStateText}>No {config.title.toLowerCase()} match this view.</Text>
          ) : filtered.map((item, i) => (
            <FadeSlideIn key={item[config.idField] || i} delay={Math.min(i, 10) * 40} style={styles.entityRow}>
              <TouchableOpacity activeOpacity={0.8} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => openDetail(item)}>
                <View style={styles.entityRowIconWrap}><Icon size={16} color={ACCENT} /></View>
                <View style={{ flex: 1, paddingRight: 6 }}>
                  <Text style={styles.leadName} numberOfLines={1}>{item[config.titleField] || config.title}</Text>
                  <Text style={styles.leadSub} numberOfLines={1}>
                    {config.subtitleFields.map((f) => item[f]).filter(Boolean).join(' · ') || '—'}
                  </Text>
                </View>
                {config.amountField && <Text style={styles.leadDeposit}>{formatCompactMoney(item[config.amountField])}</Text>}
                <View style={[styles.statusBadge, statusColor(item[config.statusField])]}>
                  <Text style={styles.statusBadgeText} numberOfLines={1}>{item[config.statusField] || 'Unspecified'}</Text>
                </View>
                <ChevronRight size={15} color="#3a3a44" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </FadeSlideIn>
          ))}
        </ScrollView>
      )}

      <DetailModal
        visible={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title}
        subtitle={detail?.subtitle}
        icon={detail?.icon}
        fields={detail?.fields || []}
      />
    </SafeAreaView>
  );
};

const LeadsPipelineScreen = (props) => <EntityListScreen {...props} entityKey="leads" config={ENTITY_UI.leads} />;
const ShipmentsScreen = (props) => <EntityListScreen {...props} entityKey="shipments" config={ENTITY_UI.shipments} />;
const FinancingScreen = (props) => <EntityListScreen {...props} entityKey="financing" config={ENTITY_UI.financing} />;
const LogisticsScreen = (props) => <EntityListScreen {...props} entityKey="logistics" config={ENTITY_UI.logistics} />;
const PortsScreen = (props) => <EntityListScreen {...props} entityKey="ports" config={ENTITY_UI.ports} />;

// PLACEHOLDER SCREEN
const PlaceholderScreen = ({ navigation, title, description, icon: Icon }) => (
  <SafeAreaView style={styles.container}>
    <ScreenHeader navigation={navigation} title={title} />
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 34 }}>
      <View style={styles.placeholderIconWrap}><Icon size={26} color={ACCENT} /></View>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderDesc}>{description}</Text>
    </View>
  </SafeAreaView>
);
const WorkflowConsoleScreen = (props) => (
  <PlaceholderScreen {...props} title="Workflow Console" icon={Sliders}
    description="Custom automation workflows are coming soon. In the meantime, ask Maya — she already handles record CRUD, reminders, and report generation directly." />
);
const SettingsScreen = (props) => (
  <PlaceholderScreen {...props} title="Settings" icon={Settings}
    description="Account and system preferences are coming soon." />
);

// BOTTOM TAB BAR — Home / Maya / Reports
const TAB_META = {
  Home: { label: 'Home', icon: Home },
  MayaTab: { label: 'Maya', icon: Bot },
  ReportsTab: { label: 'Reports', icon: FileText },
};

const CustomTabBar = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.min(insets.bottom, 16);
  return (
    <View style={[styles.tabBarContainer, { paddingBottom: bottomInset + 4 }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const meta = TAB_META[route.name];
        const Icon = meta.icon;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <AnimatedPressable key={route.key} onPress={onPress} style={styles.tabBarButton}>
            <View style={[styles.tabIconWrap, isFocused && styles.tabIconWrapActive]}>
              <Icon size={20} color={isFocused ? ACCENT : '#6b6b78'} />
            </View>
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{meta.label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
};

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="MayaTab" component={MayaAgentConsoleScreen} />
      <Tab.Screen name="ReportsTab" component={ReportsVaultScreen} />
    </Tab.Navigator>
  );
}

// CUSTOM DRAWER MENU CONTENT
const OPERATIONS_ITEMS = [
  { label: 'Financing Partners', component: FinancingScreen, icon: Layers },
  { label: 'Leads Pipeline', component: LeadsPipelineScreen, icon: TrendingUp },
  { label: 'Logistics', component: LogisticsScreen, icon: Truck },
  { label: 'Ports', component: PortsScreen, icon: Anchor },
  { label: 'Shipments', component: ShipmentsScreen, icon: Container },
  { label: 'Workflow Console', component: WorkflowConsoleScreen, icon: Sliders },
].sort((a, b) => a.label.localeCompare(b.label));

const DrawerRow = ({ icon: Icon, label, onPress, danger }) => (
  <AnimatedPressable onPress={onPress} style={styles.drawerRow} leakColor={danger ? DANGER : ACCENT}>
    <View style={[styles.drawerRowIconWrap, danger && styles.drawerRowIconWrapDanger]}>
      <Icon size={16} color={danger ? DANGER : '#c9c9d4'} />
    </View>
    <Text style={[styles.drawerRowLabel, danger && styles.drawerRowLabelDanger]} numberOfLines={1}>{label}</Text>
    {!danger && <ChevronRight size={15} color="#3a3a44" />}
  </AnimatedPressable>
);

function CustomDrawerContent(props) {
  const goTo = (name) => props.navigation.navigate(name);

  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: '#09090b' }} contentContainerStyle={{ flexGrow: 1, paddingTop: 0 }}>
      <View style={styles.drawerHeader}>
        <View style={styles.drawerBrandRow}>
          <View style={styles.drawerBrandBadge}><Bot size={20} color={ACCENT} /></View>
          <View>
            <Text style={styles.drawerBrandText}>OGAMOTO CRM</Text>
            <Text style={styles.drawerUserText}>Admin Console · John Doe</Text>
          </View>
        </View>
      </View>

      <Text style={styles.drawerSectionLabel}>OPERATIONS</Text>
      {OPERATIONS_ITEMS.map((item) => (
        <DrawerRow key={item.label} icon={item.icon} label={item.label} onPress={() => goTo(item.label)} />
      ))}

      <Text style={styles.drawerSectionLabel}>SYSTEM</Text>
      <DrawerRow icon={Settings} label="Settings" onPress={() => goTo('Settings')} />

      <View style={{ flex: 1, minHeight: 20 }} />

      <View style={styles.drawerDivider} />
      <DrawerRow
        icon={LogOut}
        label="Logout"
        danger
        onPress={() => props.navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
      />
      <Text style={styles.drawerBuildStamp}>{BUILD_STAMP}</Text>
    </DrawerContentScrollView>
  );
}

// MAIN DRAWER NAVIGATOR
function MainDrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: '#09090b', width: 288 },
        drawerType: 'front',
        swipeEnabled: true,
        swipeEdgeWidth: 60,
        overlayColor: 'rgba(0,0,0,0.6)',
        sceneContainerStyle: { backgroundColor: '#09090b' },
      }}
    >
      <Drawer.Screen name="MainTabs" component={MainTabs} />
      {OPERATIONS_ITEMS.map((item) => (
        <Drawer.Screen key={item.label} name={item.label} component={item.component} />
      ))}
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
}

// ROOT APP
export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#09090b' }}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="MainDrawer" component={MainDrawerNavigator} />
          </Stack.Navigator>
        </NavigationContainer>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

// STYLESHEET
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  screenHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a22', backgroundColor: '#09090b' },
  screenHeaderTitle: { color: ACCENT, fontWeight: '800', fontSize: 15, letterSpacing: 0.4, flexShrink: 1 },

  iconButtonTarget: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  loginContainer: { flex: 1, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center' },
  loginGlow: { position: 'absolute', width: width * 1.4, height: width * 1.4, borderRadius: width * 0.7, backgroundColor: ACCENT, opacity: 0.07, top: -width * 0.65, left: -width * 0.2 },
  loginGlowSecondary: { position: 'absolute', width: width * 1.1, height: width * 1.1, borderRadius: width * 0.55, backgroundColor: '#00E5A0', opacity: 0.04, bottom: -width * 0.55, right: -width * 0.35 },
  loginCard: { width: width * 0.85, padding: 24, backgroundColor: '#101014', borderRadius: 22, borderWidth: 1, borderColor: '#1a1a22' },
  brandBadge: { alignSelf: 'center', width: 46, height: 46, borderRadius: 14, backgroundColor: '#09090b', borderWidth: 1, borderColor: 'rgba(0,229,255,0.35)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  loginBrandText: { fontSize: 26, fontWeight: '900', color: ACCENT, textAlign: 'center', letterSpacing: 4 },
  loginTagline: { fontSize: 9.5, color: '#fff', opacity: 0.4, textAlign: 'center', letterSpacing: 2, marginBottom: 26, marginTop: 6 },
  buildStampText: { color: '#3a3a44', fontSize: 9.5, marginTop: 18, letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#09090b', borderWidth: 1, borderColor: '#1a1a22', borderRadius: 13, marginBottom: 14, paddingHorizontal: 14, overflow: 'hidden' },
  inputIcon: { marginRight: 10 },
  authInputField: { flex: 1, height: 46, color: '#fff', fontSize: 13 },
  loginSubmitButton: { backgroundColor: ACCENT, height: 48, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  loginSubmitButtonDisabled: { opacity: 0.7 },
  loginButtonText: { color: '#09090b', fontWeight: '800', fontSize: 12, letterSpacing: 1 },

  brandLoaderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#09090bF2', justifyContent: 'center', alignItems: 'center' },
  brandLoaderRingWrap: { width: 84, height: 84, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  brandLoaderRing: { position: 'absolute', width: 84, height: 84, borderRadius: 42, borderWidth: 2.5, borderColor: 'rgba(0,229,255,0.15)', borderTopColor: ACCENT },
  brandLoaderBadge: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#101014', borderWidth: 1, borderColor: 'rgba(0,229,255,0.35)', justifyContent: 'center', alignItems: 'center' },
  brandLoaderText: { color: '#ccc', fontSize: 12, fontWeight: '600', marginBottom: 18 },
  brandLoaderTrack: { width: 160, height: 4, borderRadius: 2, backgroundColor: '#1a1a22', overflow: 'hidden' },
  brandLoaderFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 2 },

  drawerHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#1a1a22', marginBottom: 10 },
  drawerBrandRow: { flexDirection: 'row', alignItems: 'center' },
  drawerBrandBadge: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#101014', borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  drawerBrandText: { color: ACCENT, fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  drawerUserText: { color: '#666', fontSize: 10.5, marginTop: 2 },
  drawerSectionLabel: { color: '#4a4a55', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, paddingHorizontal: 20, marginTop: 14, marginBottom: 8 },
  drawerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, marginHorizontal: 10, borderRadius: 12 },
  drawerRowIconWrap: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#101014', borderWidth: 1, borderColor: '#1a1a22', justifyContent: 'center', alignItems: 'center', marginRight: 13 },
  drawerRowIconWrapDanger: { borderColor: 'rgba(255,90,90,0.35)' },
  drawerRowLabel: { flex: 1, color: '#d6d6dc', fontSize: 12.5, fontWeight: '600' },
  drawerRowLabelDanger: { color: DANGER },
  drawerDivider: { height: 1, backgroundColor: '#1a1a22', marginHorizontal: 20, marginBottom: 8, marginTop: 4 },
  drawerBuildStamp: { color: '#3a3a44', fontSize: 9.5, textAlign: 'center', marginTop: 14, marginBottom: 6, letterSpacing: 0.5 },

  refreshBtn: { width: 36, height: 36, backgroundColor: '#101014', borderRadius: 10, borderWidth: 1, borderColor: '#1a1a22', justifyContent: 'center', alignItems: 'center' },
  brandMicroLabel: { color: ACCENT, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.6, marginBottom: 2 },
  greetingText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  liveSubText: { fontSize: 10.5, color: '#777', fontWeight: '600' },
  sectionSubHeading: { fontSize: 11.5, fontWeight: '700', color: ACCENT, letterSpacing: 1 },
  filterNote: { color: '#666', fontSize: 10.5, marginBottom: 8, fontStyle: 'italic' },
  clearFilterText: { color: ACCENT, fontSize: 11, fontWeight: '700' },

  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,90,90,0.08)', borderWidth: 1, borderColor: 'rgba(255,90,90,0.35)', borderRadius: 12, padding: 12, marginBottom: 16 },
  errorBannerText: { color: '#ffb3b3', fontSize: 11, flex: 1 },
  errorBannerRetry: { backgroundColor: 'rgba(255,90,90,0.18)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginLeft: 8 },
  errorBannerRetryText: { color: '#ff8080', fontSize: 10.5, fontWeight: '700' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  dashboardMetricItem: { backgroundColor: '#101014', flex: 1, minHeight: 110, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#1a1a22', justifyContent: 'space-between' },
  activeItemCard: { borderColor: ACCENT },
  metricIconWrap: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center' },
  metricIconWrapActive: { backgroundColor: 'rgba(0,229,255,0.1)' },
  dashboardMetricNumber: { fontSize: 18, fontWeight: '800', color: '#fff' },
  dashboardMetricLabel: { color: '#777', fontSize: 10.5, fontWeight: '600', marginTop: 2 },

  timeFilterContainer: { flexDirection: 'row', backgroundColor: '#101014', borderRadius: 8, padding: 2, borderWidth: 1, borderColor: '#1a1a22' },
  timeFilterBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  timeFilterBadgeActive: { backgroundColor: ACCENT },
  timeFilterText: { color: '#666', fontSize: 10, fontWeight: '700' },
  timeFilterTextActive: { color: '#09090b' },

  systemStatusLedgerAlertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101014', padding: 14, borderRadius: 13, borderWidth: 1, borderColor: '#1a1a22', marginTop: 10 },
  ledgerIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', marginRight: 12 },

  graphContainerCanvas: { backgroundColor: '#101014', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#1a1a22', minHeight: 210, justifyContent: 'flex-end' },
  graphBarsAxisContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', width: '100%' },
  individualBarColumn: { alignItems: 'center', width: 55 },
  interactiveChartBarLine: { width: 24, backgroundColor: ACCENT, borderRadius: 6 },
  barMarkerLabels: { color: '#666', fontSize: 9.5, marginTop: 8, fontWeight: '700' },
  barMarkerValueText: { color: '#fff', fontSize: 9.5, marginBottom: 6, fontWeight: '600' },
  emptyStateText: { color: '#555', fontSize: 12, textAlign: 'center', paddingVertical: 30 },

  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusChip: { backgroundColor: '#101014', flex: 1, minWidth: '45%', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 13, borderWidth: 1, borderColor: '#1a1a22', alignItems: 'center' },
  statusChipActive: { borderColor: ACCENT, backgroundColor: 'rgba(0,229,255,0.08)' },
  statusChipCount: { color: '#fff', fontWeight: '800', fontSize: 18 },
  statusChipLabel: { color: '#777', fontSize: 10, marginTop: 2, fontWeight: '600', textAlign: 'center' },

  leadRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101014', padding: 12, borderRadius: 13, borderWidth: 1, borderColor: '#1a1a22', marginBottom: 8 },
  leadName: { color: '#fff', fontWeight: '700', fontSize: 12.5 },
  leadSub: { color: '#666', fontSize: 10.5, marginTop: 2 },
  leadDeposit: { color: ACCENT, fontWeight: '700', fontSize: 12, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, maxWidth: 110 },
  statusBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },

  shipmentSummaryRow: { flexDirection: 'row', marginBottom: 10, flexWrap: 'wrap' },
  shipmentSummaryChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101014', borderWidth: 1, borderColor: '#1a1a22', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginRight: 10, marginBottom: 6 },
  shipmentSummaryText: { color: '#ccc', fontSize: 11, marginLeft: 6, fontWeight: '600' },
  shipmentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101014', padding: 12, borderRadius: 13, borderWidth: 1, borderColor: '#1a1a22', marginBottom: 8 },
  shipmentStatusText: { color: ACCENT, fontSize: 10.5, fontWeight: '700' },

  msgBubble: { padding: 13, borderRadius: 17, marginVertical: 5, maxWidth: '85%', flexDirection: 'row', alignItems: 'flex-start' },
  botBubble: { backgroundColor: '#101014', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#1a1a22' },
  userBubble: { backgroundColor: ACCENT, alignSelf: 'flex-end' },
  botAvatar: { width: 19, height: 19, borderRadius: 6, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', marginRight: 8, marginTop: 1 },
  msgText: { color: '#eaeaea', fontSize: 12.5, lineHeight: 18, flexShrink: 1 },
  userMsgText: { color: '#09090b', fontWeight: '600' },

  inputContainer: { flexDirection: 'row', padding: 14, backgroundColor: '#09090b', borderTopWidth: 1, borderTopColor: '#1a1a22', alignItems: 'center' },
  chatInput: { flex: 1, backgroundColor: '#101014', color: '#fff', paddingHorizontal: 16, height: 44, borderRadius: 22, marginRight: 10, borderWidth: 1, borderColor: '#1a1a22' },
  sendButton: { backgroundColor: ACCENT, width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },

  reportCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#101014', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#1a1a22', marginBottom: 11 },
  downloadBtn: { backgroundColor: ACCENT, width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  generateReportBtn: { backgroundColor: ACCENT, width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  tabBarContainer: { flexDirection: 'row', backgroundColor: '#0c0c10', borderTopWidth: 1, borderTopColor: '#1a1a22', paddingTop: 6, paddingHorizontal: 12 },
  tabBarButton: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  tabIconWrap: { width: 44, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  tabIconWrapActive: { backgroundColor: 'rgba(0,229,255,0.14)' },
  tabLabel: { fontSize: 10.5, fontWeight: '700', color: '#6b6b78' },
  tabLabelActive: { color: ACCENT },

  searchBarWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101014', borderWidth: 1, borderColor: '#1a1a22', borderRadius: 12, marginHorizontal: 18, marginTop: 14, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, color: '#fff', fontSize: 12.5, height: '100%' },
  filterChipRow: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 2, gap: 8 },
  filterChip: { backgroundColor: '#101014', borderWidth: 1, borderColor: '#1a1a22', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7, marginRight: 8 },
  filterChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  filterChipText: { color: '#999', fontSize: 11, fontWeight: '700' },
  filterChipTextActive: { color: '#09090b' },
  entityRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101014', padding: 12, borderRadius: 13, borderWidth: 1, borderColor: '#1a1a22', marginBottom: 8 },
  entityRowIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', marginRight: 12 },

  placeholderIconWrap: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#101014', borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  placeholderTitle: { color: '#fff', fontWeight: '800', fontSize: 16, marginBottom: 8 },
  placeholderDesc: { color: '#777', fontSize: 12, textAlign: 'center', lineHeight: 18, maxWidth: 280 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#101014', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: '#1a1a22', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 22 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#2a2a34', alignSelf: 'center', marginBottom: 14 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  modalIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#09090b', borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  modalTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  modalSubtitle: { color: ACCENT, fontSize: 11, fontWeight: '600', marginTop: 2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#09090b', borderWidth: 1, borderColor: '#1a1a22' },
  modalFieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a22' },
  modalFieldLabel: { color: '#777', fontSize: 11.5, fontWeight: '600', flex: 1 },
  modalFieldValue: { color: '#fff', fontSize: 12.5, fontWeight: '600', flex: 1.4, textAlign: 'right' },
});
