import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export interface Currency {
  code: string;
  symbol: string;
  rate: number; // Rate relative to USD (base)
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', rate: 1 },
  { code: 'EUR', symbol: '€', rate: 0.92 },
  { code: 'GBP', symbol: '£', rate: 0.79 },
  { code: 'JPY', symbol: '¥', rate: 150.50 },
  { code: 'CAD', symbol: 'C$', rate: 1.35 },
  { code: 'AUD', symbol: 'A$', rate: 1.52 },
  { code: 'INR', symbol: '₹', rate: 83.00 },
  { code: 'PKR', symbol: 'Rs', rate: 278.00 },
];

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (code: string) => void;
  formatAmount: (amount: number) => string;
  convertAmount: (amount: number) => number;
  SUPPORTED_CURRENCIES: Currency[];
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currency, setCurrencyState] = useState<Currency>(SUPPORTED_CURRENCIES[0]);

  useEffect(() => {
    if (user && (user as any).currency) {
      const savedCurrency = SUPPORTED_CURRENCIES.find(c => c.code === (user as any).currency);
      if (savedCurrency) {
        setCurrencyState(savedCurrency);
      }
    }
  }, [user]);

  const setCurrency = async (code: string) => {
    const newCurrency = SUPPORTED_CURRENCIES.find(c => c.code === code);
    if (newCurrency) {
      setCurrencyState(newCurrency);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.id);
          await updateDoc(userDocRef, { currency: code });
        } catch (err) {
          console.error('Failed to save currency preference', err);
        }
      }
    }
  };

  const convertAmount = (amount: number) => {
    return amount * currency.rate;
  };

  const formatAmount = (amount: number) => {
    const converted = convertAmount(amount);
    return `${currency.symbol} ${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatAmount, convertAmount, SUPPORTED_CURRENCIES }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within CurrencyProvider');
  return context;
};
