// App-wide state management (React Context)
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Guest, QRPayload } from '../types';

interface AppState {
  // Guest registration
  guestName: string;
  guestPhone: string;
  isHostSet: boolean;
  billOwnerName: string;
  billOwnerPhone: string;
  // Table
  qrPayload: QRPayload | null;
  // Guests
  tableGuests: Guest[];
  pendingRequests: any[];
  // Cart
  cart: any[];
  // Staff
  staffToken: string | null;
  staffName: string;
}

const initialState: AppState = {
  guestName: '',
  guestPhone: '',
  isHostSet: false,
  billOwnerName: '',
  billOwnerPhone: '',
  qrPayload: null,
  tableGuests: [],
  pendingRequests: [],
  cart: [],
  staffToken: null,
  staffName: '',
};

interface AppContextType extends AppState {
  setGuestInfo: (name: string, phone: string) => void;
  setBillOwner: (name: string, phone: string) => void;
  setQRPayload: (payload: QRPayload | null) => void;
  addGuest: (guest: Guest) => void;
  addPendingRequest: (req: any) => void;
  approveRequest: (id: string) => void;
  denyRequest: (id: string) => void;
  addToCart: (item: any) => void;
  removeFromCart: (index: number) => void;
  updateCartQty: (index: number, qty: number) => void;
  clearCart: () => void;
  setStaffToken: (token: string | null) => void;
  setStaffName: (name: string) => void;
  reset: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);

  // Load persisted state on mount
  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    try {
      const saved = await AsyncStorage.getItem('mazi_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        setState({ ...initialState, ...parsed });
      }
    } catch {}
  };

  // Persist state on change
  const saveState = async (newState: AppState) => {
    try {
      await AsyncStorage.setItem('mazi_state', JSON.stringify(newState));
    } catch {}
  };

  const update = (partial: Partial<AppState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      saveState(next);
      return next;
    });
  };

  const setGuestInfo = (name: string, phone: string) => {
    update({ guestName: name, guestPhone: phone });
  };

  const setBillOwner = (name: string, phone: string) => {
    update({
      isHostSet: true,
      billOwnerName: name,
      billOwnerPhone: phone,
      tableGuests: [{ id: '0', name: name + ' (You)', phone, role: 'owner', approved: true }],
    });
  };

  const setQRPayload = (payload: QRPayload | null) => {
    update({ qrPayload: payload });
  };

  const addGuest = (guest: Guest) => {
    setState((prev) => {
      const next = { ...prev, tableGuests: [...prev.tableGuests, guest] };
      saveState(next);
      return next;
    });
  };

  const addPendingRequest = (req: any) => {
    setState((prev) => {
      const next = { ...prev, pendingRequests: [...prev.pendingRequests, req] };
      saveState(next);
      return next;
    });
  };

  const approveRequest = (id: string) => {
    setState((prev) => {
      const req = prev.pendingRequests.find((r) => r.id === id);
      const next: AppState = {
        ...prev,
        pendingRequests: prev.pendingRequests.filter((r) => r.id !== id),
      };
      if (req) {
        next.tableGuests = [
          ...prev.tableGuests,
          { id: req.id, name: req.name, phone: req.phone, role: 'guest', approved: true },
        ];
      }
      saveState(next);
      return next;
    });
  };

  const denyRequest = (id: string) => {
    setState((prev) => {
      const next = { ...prev, pendingRequests: prev.pendingRequests.filter((r) => r.id !== id) };
      saveState(next);
      return next;
    });
  };

  const addToCart = (item: any) => {
    setState((prev) => {
      const existing = prev.cart.findIndex(
        (c) => c.product.id === item.product.id,
      );
      let cart: any[];
      if (existing >= 0) {
        cart = [...prev.cart];
        cart[existing].quantity += item.quantity;
      } else {
        cart = [...prev.cart, item];
      }
      const next = { ...prev, cart };
      saveState(next);
      return next;
    });
  };

  const removeFromCart = (index: number) => {
    setState((prev) => {
      const cart = [...prev.cart];
      cart.splice(index, 1);
      const next = { ...prev, cart };
      saveState(next);
      return next;
    });
  };

  const updateCartQty = (index: number, qty: number) => {
    setState((prev) => {
      const cart = [...prev.cart];
      if (qty <= 0) {
        cart.splice(index, 1);
      } else {
        cart[index] = { ...cart[index], quantity: qty };
      }
      const next = { ...prev, cart };
      saveState(next);
      return next;
    });
  };

  const clearCart = () => update({ cart: [] });

  const setStaffToken = (token: string | null) => update({ staffToken: token });
  const setStaffName = (name: string) => update({ staffName: name });

  const reset = () => {
    setState(initialState);
    AsyncStorage.removeItem('mazi_state');
  };

  return (
    <AppContext.Provider
      value={{
        ...state,
        setGuestInfo,
        setBillOwner,
        setQRPayload,
        addGuest,
        addPendingRequest,
        approveRequest,
        denyRequest,
        addToCart,
        removeFromCart,
        updateCartQty,
        clearCart,
        setStaffToken,
        setStaffName,
        reset,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}