import React, { useState, useRef, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Image, Dimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { WebView } from 'react-native-webview';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync(); // Keep splash until ready

const { width, height } = Dimensions.get('window');

const CRMWebView = () => {
  const [loading, setLoading] = useState(true);
  const webRef = useRef(null);

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading Premier CRM...</Text>
        </View>
      )}
      <WebView
        ref={webRef}
        source={{ uri: 'https://pap-crm.vercel.app/' }}
        style={styles.webview}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading CRM...</Text>
          </View>
        )}
        onLoadEnd={() => setLoading(false)}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error:', nativeEvent);
        }}
        allowsFullscreenVideo={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        allowsInlineMediaPlayback={true}
        // Inject JS to hide any unwanted elements or improve mobile feel if needed
        injectedJavaScript={`
          document.documentElement.style.setProperty('--mobile-view', 'true');
          // Add more custom JS here if the web app needs tweaks for mobile
        `}
      />
    </View>
  );
};

// Simple Home / Other screens
const HomeScreen = () => (
  <View style={styles.centered}>
    <Text style={{ fontSize: 24 }}>Welcome to Premier CRM</Text>
    <Text>Use the menu to access the full CRM</Text>
  </View>
);

const Drawer = createDrawerNavigator();

export default function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      // Simulate any async setup (fonts, etc.)
      await new Promise(resolve => setTimeout(resolve, 1500)); // Adjust as needed
      setAppReady(true);
      await SplashScreen.hideAsync();
    }
    prepare();
  }, []);

if (!appReady) {
  return (
    <View style={styles.splashContainer}>
      <Image
        source={{ uri: 'https://via.placeholder.com/600x800/1a1a1a/ffffff?text=PREMIER+AUTO+PLUS' }}
        style={styles.fullLogo}
        resizeMode="contain"
      />
    </View>
  );
}

  return (
    <NavigationContainer>
      <Drawer.Navigator
        initialRouteName="CRM"
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: '#1a1a1a' },
          headerTintColor: '#fff',
          drawerStyle: { backgroundColor: '#1a1a1a' },
          drawerLabelStyle: { color: '#fff' },
        }}
      >
        <Drawer.Screen 
          name="CRM" 
          component={CRMWebView} 
          options={{ title: 'Premier CRM' }}
        />
        <Drawer.Screen name="Home" component={HomeScreen} />
        {/* Add more menu items: Dashboard, Leads, Settings, etc. */}
      </Drawer.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webview: { flex: 1 },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa', // or match web app theme
    zIndex: 10,
  },
  loadingText: { marginTop: 10, color: '#333', fontSize: 16 },
  splashContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a', // Brand color
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullLogo: {
    width: width * 0.8,
    height: height * 0.5,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});