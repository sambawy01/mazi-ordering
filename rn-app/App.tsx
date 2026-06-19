import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import * as SplashScreen from 'expo-splash-screen';

import { AppProvider } from './src/services/AppContext';
import { COLORS } from './src/theme';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import PhoneEntryScreen from './src/screens/PhoneEntryScreen';
import OtpScreen from './src/screens/OtpScreen';
import WaitingScreen from './src/screens/WaitingScreen';
import ClientMenuScreen from './src/screens/ClientMenuScreen';
import MenuScreen from './src/screens/MenuScreen';
import CartScreen from './src/screens/CartScreen';
import OrderStatusScreen from './src/screens/OrderStatusScreen';
import StaffLoginScreen from './src/screens/StaffLoginScreen';
import StaffTablesScreen from './src/screens/StaffTablesScreen';
import StaffTableDetailScreen from './src/screens/StaffTableDetailScreen';
import ApprovalsScreen from './src/screens/ApprovalsScreen';
import BillScreen from './src/screens/BillScreen';
import SplitBillScreen from './src/screens/SplitBillScreen';
import SettleBillScreen from './src/screens/SettleBillScreen';
import GuestBillScreen from './src/screens/GuestBillScreen';
import PaymentProcessingScreen from './src/screens/PaymentProcessingScreen';
import PaymentResultScreen from './src/screens/PaymentResultScreen';

// Keep splash visible while we bootstrap (no-op if not installed; safe)
SplashScreen.preventAutoHideAsync?.().catch(() => {});

// Root stack param list — centralised for type-safety
export type RootStackParamList = {
  Home: undefined;
  Scanner: undefined;
  PhoneEntry: { qrPayloadString: string } | undefined;
  Otp: { name: string; phone: string; qrPayloadString?: string } | undefined;
  Waiting: { name: string; phone: string };
  ClientMenu: undefined;
  Menu: undefined;
  Cart: undefined;
  OrderStatus: { orderId: string; isHost?: boolean } | undefined;
  StaffLogin: undefined;
  StaffTables: undefined;
  StaffTableDetail: { tableId: string };
  Approvals: undefined;
  Bill: { orderId: string; tableId?: string; isHost?: boolean; guestShare?: number };
  SplitBill: { tableId: string };
  SettleBill: { tableId: string };
  GuestBill: { tableId: string; orderId: string; guestName: string; payerCount: number };
  PaymentProcessing: { orderId: string; iframeUrl: string; method: 'card' | 'instapay' | 'apple_pay' };
  PaymentResult: { orderId: string; success: boolean; method?: 'card' | 'instapay' | 'apple_pay' | 'cash' };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Theme for React Navigation — tinted with MAZI blue/gold
const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    background: COLORS.blueBg,
    card: COLORS.surface,
    text: COLORS.text,
    border: COLORS.outline,
    notification: COLORS.gold,
  },
};

const paperTheme = {
  dark: false,
  colors: {
    primary: COLORS.primary,
    accent: COLORS.gold,
    background: COLORS.surface,
    surface: COLORS.surface,
    text: COLORS.text,
    onSurface: COLORS.text,
    disabled: COLORS.outline,
    placeholder: COLORS.textVariant,
    backdrop: COLORS.overlay,
  },
};

function AppStack() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: '700' as const },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.blueBg },
      }}
    >
      {/* Guest flow */}
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'MAZI', headerShown: false }} />
      <Stack.Screen name="Scanner" component={ScannerScreen} options={{ title: 'Scan Table QR', headerShown: false }} />
      <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} options={{ title: 'Your Details' }} />
      <Stack.Screen name="Otp" component={OtpScreen} options={{ title: 'Verify Phone' }} />
      <Stack.Screen name="Waiting" component={WaitingScreen} options={{ title: 'Approval', headerBackVisible: false }} />
      <Stack.Screen name="ClientMenu" component={ClientMenuScreen} options={{ title: 'MAZI', headerBackVisible: false }} />
      <Stack.Screen name="Menu" component={MenuScreen} options={{ title: 'Menu' }} />
      <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Your Cart' }} />
      <Stack.Screen name="OrderStatus" component={OrderStatusScreen} options={{ title: 'Order Status' }} />

      {/* Payment flow */}
      <Stack.Screen name="Bill" component={BillScreen} options={{ title: 'Bill & Payment' }} />
      <Stack.Screen name="SplitBill" component={SplitBillScreen} options={{ title: 'Split Bill' }} />
      <Stack.Screen name="SettleBill" component={SettleBillScreen} options={{ title: 'Settle Bill' }} />
      <Stack.Screen name="GuestBill" component={GuestBillScreen} options={{ title: 'Your Share' }} />
      <Stack.Screen name="PaymentProcessing" component={PaymentProcessingScreen} options={{ title: 'Secure Payment' }} />
      <Stack.Screen name="PaymentResult" component={PaymentResultScreen} options={{ headerShown: false }} />

      {/* Staff flow */}
      <Stack.Screen name="StaffLogin" component={StaffLoginScreen} options={{ title: 'Staff Login', headerShown: false }} />
      <Stack.Screen name="StaffTables" component={StaffTablesScreen} options={{ title: 'Tables', headerBackVisible: false }} />
      <Stack.Screen name="StaffTableDetail" component={StaffTableDetailScreen} options={{ title: 'Table' }} />
      <Stack.Screen name="Approvals" component={ApprovalsScreen} options={{ title: 'Guest Approvals' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <PaperProvider theme={paperTheme as any}>
      <AppProvider>
        <NavigationContainer theme={NavTheme}>
          <StatusBar style="light" />
          <AppStack />
        </NavigationContainer>
      </AppProvider>
    </PaperProvider>
  );
}
