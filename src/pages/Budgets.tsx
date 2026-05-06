import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Plus, AlertCircle, Edit2, Trash2, Coins, Globe, ChevronDown, Check, Utensils, Car, ShoppingBag, Home, FileText, Film, HeartPulse, GraduationCap, MoreHorizontal, Wallet, TrendingUp, TrendingDown, PiggyBank, ChevronLeft, ChevronRight, Calendar, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../AuthContext';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { useCurrency } from '../contexts/CurrencyContext';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isSameMonth, isAfter } from 'date-fns';

const categoryIcons: Record<string, React.ReactNode> = {
  'Food': <Utensils size={20} />,
  'Transport': <Car size={20} />,
  'Shopping': <ShoppingBag size={20} />,
  'Rent': <Home size={20} />,
  'Bills': <FileText size={20} />,
  'Entertainment': <Film size={20} />,
  'Health': <HeartPulse size={20} />,
  'Education': <GraduationCap size={20} />,
  'Other': <MoreHorizontal size={20} />,
};

const Budgets = () => {
  const { user } = useAuth();
  const { currency, setCurrency, SUPPORTED_CURRENCIES, formatAmount } = useCurrency();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [actuals, setActuals] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [globalBudgetLimit, setGlobalBudgetLimit] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGlobalLimitModalOpen, setIsGlobalLimitModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ category: 'Food', limit: '' });
  const [globalLimitInput, setGlobalLimitInput] = useState('');
  const [savingsRate, setSavingsRate] = useState(0);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [isSavingsDropdownOpen, setIsSavingsDropdownOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isNavigating, setIsNavigating] = useState(false);
  const [lifetimeSavings, setLifetimeSavings] = useState(0);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);
  const savingsDropdownRef = useRef<HTMLDivElement>(null);

  const categories = ['Food', 'Transport', 'Shopping', 'Rent', 'Bills', 'Entertainment', 'Health', 'Education', 'Other'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(event.target as Node)) {
        setIsCurrencyDropdownOpen(false);
      }
      if (savingsDropdownRef.current && !savingsDropdownRef.current.contains(event.target as Node)) {
        setIsSavingsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    if (!user) return;
    setIsNavigating(true);
    try {
      const monthStr = format(currentDate, 'yyyy-MM');
      const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

      const budgetsQuery = query(
        collection(db, 'budgets'), 
        where('userId', '==', user.id),
        where('month', '==', monthStr)
      );
      
      const expensesQuery = query(
        collection(db, 'expenses'), 
        where('userId', '==', user.id),
        where('date', '>=', start),
        where('date', '<=', end)
      );

      const configsQuery = query(
        collection(db, 'monthly_configs'),
        where('userId', '==', user.id),
        where('month', '==', monthStr)
      );

      // Fetch ALL historical data for lifetime savings
      // Note: In a production app with massive data, this should be an aggregation or summary doc.
      const allExpensesQuery = query(
        collection(db, 'expenses'),
        where('userId', '==', user.id)
      );

      const allConfigsQuery = query(
        collection(db, 'monthly_configs'),
        where('userId', '==', user.id)
      );

      const allBudgetsQuery = query(
        collection(db, 'budgets'),
        where('userId', '==', user.id)
      );
      
      const [budgetsSnapshot, expensesSnapshot, configsSnapshot, allExpensesSnapshot, allConfigsSnapshot, allBudgetsSnapshot] = await Promise.all([
        getDocs(budgetsQuery),
        getDocs(expensesQuery),
        getDocs(configsQuery),
        getDocs(allExpensesQuery),
        getDocs(allConfigsQuery),
        getDocs(allBudgetsQuery)
      ]);

      const budgetsData = budgetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const expensesData = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const configData = configsSnapshot.docs[0]?.data();

      setBudgets(budgetsData);
      setExpenses(expensesData);
      
      // Calculate actuals from expensesData
      const categoryTotals: Record<string, number> = {};
      expensesData.forEach((exp: any) => {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
      });
      const actualsData = Object.entries(categoryTotals).map(([category, amount]) => ({ category, amount }));
      setActuals(actualsData);

      // STRICT ISOLATION: Use ONLY month-specific limit.
      const currentGlobalLimit = configData?.total_budget_limit ?? 0;
      const currentSavingsRate = configData?.savings_rate ?? 0;
      setGlobalBudgetLimit(currentGlobalLimit);
      setSavingsRate(currentSavingsRate);

      // Calculate Lifetime Savings
      const historicalExpenses = allExpensesSnapshot.docs.map(doc => doc.data());
      const historicalConfigs = allConfigsSnapshot.docs.map(doc => doc.data());
      const historicalBudgets = allBudgetsSnapshot.docs.map(doc => doc.data());

      // Group by month
      const monthlyData: Record<string, { globalLimit: number, categorySum: number, spent: number, rate: number }> = {};
      
      historicalConfigs.forEach((c: any) => {
        if (!monthlyData[c.month]) monthlyData[c.month] = { globalLimit: 0, categorySum: 0, spent: 0, rate: 0 };
        monthlyData[c.month].globalLimit = c.total_budget_limit || 0;
        monthlyData[c.month].rate = c.savings_rate || 0;
      });

      historicalBudgets.forEach((b: any) => {
        if (!monthlyData[b.month]) monthlyData[b.month] = { globalLimit: 0, categorySum: 0, spent: 0, rate: 0 };
        monthlyData[b.month].categorySum += b.monthly_limit || 0;
      });

      historicalExpenses.forEach((e: any) => {
        const month = e.date.substring(0, 7);
        if (!monthlyData[month]) monthlyData[month] = { globalLimit: 0, categorySum: 0, spent: 0, rate: 0 };
        monthlyData[month].spent += e.amount;
      });

      // Sum months up to (but not including) current month
      let historicalSavingsSum = 0;
      Object.entries(monthlyData).forEach(([month, data]) => {
        if (month < monthStr) {
          const effectiveMonthBudget = data.globalLimit > 0 ? data.globalLimit : data.categorySum;
          if (effectiveMonthBudget > 0) {
            // DYNAMIC SAVINGS LOGIC: Use historical rate
            const rate = data.rate / 100;
            const monthInitialSavings = effectiveMonthBudget * rate;
            const monthWorkingBudget = effectiveMonthBudget * (1 - rate);
            const monthOverrun = Math.max(0, data.spent - monthWorkingBudget);
            const monthRemainingSavings = monthInitialSavings - monthOverrun;
            historicalSavingsSum += monthRemainingSavings;
          }
        }
      });
      setLifetimeSavings(historicalSavingsSum);

    } catch (err) {
      console.error(err);
      toast.error('Failed to load data');
    } finally {
      setIsNavigating(false);
    }
  };

  const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => {
    const next = addMonths(currentDate, 1);
    // Allow navigating to future months for budgeting
    setCurrentDate(next);
  };

  const getSuggestion = () => {
    if (expenses.length === 0) return { category: 'Food', limit: '' };

    // 1. Find most frequent category
    const counts: Record<string, number> = {};
    expenses.forEach((e: any) => {
      counts[e.category] = (counts[e.category] || 0) + 1;
    });
    
    let mostFrequentCategory = 'Food';
    let maxCount = 0;
    Object.entries(counts).forEach(([cat, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentCategory = cat;
      }
    });

    // 2. Calculate average monthly spending for that category
    const categoryExpenses = expenses.filter((e: any) => e.category === mostFrequentCategory);
    const monthlySpending: Record<string, number> = {};
    categoryExpenses.forEach((e: any) => {
      const month = e.date.substring(0, 7); // YYYY-MM
      monthlySpending[month] = (monthlySpending[month] || 0) + e.amount;
    });

    const months = Object.keys(monthlySpending);
    const totalSpentInCat = Object.values(monthlySpending).reduce((a, b) => a + b, 0);
    const averageSpending = months.length > 0 ? totalSpentInCat / months.length : 0;

    return {
      category: mostFrequentCategory,
      limit: averageSpending > 0 ? (averageSpending * currency.rate).toFixed(2) : ''
    };
  };

  useEffect(() => {
    fetchData();
  }, [user, currentDate]);

  const handleSetBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      // Convert entered limit from selected currency to USD for storage
      const amountInUsd = parseFloat(formData.limit) / currency.rate;
      const monthStr = format(currentDate, 'yyyy-MM');
      
      if (editingId) {
        const budgetRef = doc(db, 'budgets', editingId);
        await updateDoc(budgetRef, {
          category: formData.category,
          monthly_limit: amountInUsd
        });
      } else {
        // Enforce one budget per category per month
        const existing = budgets.find(b => b.category === formData.category && b.month === monthStr);
        if (existing) {
           await updateDoc(doc(db, 'budgets', existing.id), { monthly_limit: amountInUsd });
        } else {
          await addDoc(collection(db, 'budgets'), {
            userId: user.id,
            category: formData.category,
            monthly_limit: amountInUsd,
            month: monthStr
          });
        }
      }
      toast.success(editingId ? 'Budget updated!' : 'Budget set!');
      handleCloseModal();
      fetchData();
    } catch (err) {
      toast.error('Failed to set budget');
    }
  };

  const handleEdit = (budget: any) => {
    setEditingId(budget.id);
    // Convert USD limit from database to selected currency for the input
    const limitInSelectedCurrency = (budget.monthly_limit * currency.rate).toFixed(2);
    setFormData({
      category: budget.category,
      limit: limitInSelectedCurrency
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ category: 'Food', limit: '' });
  };

  const handleDeleteClick = (id: number) => {
    setDeletingId(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteDoc(doc(db, 'budgets', deletingId));
      toast.success('Budget removed');
      fetchData();
      setIsDeleteModalOpen(false);
    } catch (err) {
      toast.error('Failed to remove budget');
    }
  };

  const handleSetGlobalLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const amountInUsd = parseFloat(globalLimitInput) / currency.rate;
      const monthStr = format(currentDate, 'yyyy-MM');
      
      // Optimistic local update
      setGlobalBudgetLimit(amountInUsd);
      
      const configsQuery = query(
        collection(db, 'monthly_configs'),
        where('userId', '==', user.id),
        where('month', '==', monthStr)
      );
      const configSnapshot = await getDocs(configsQuery);
      
      if (!configSnapshot.empty) {
        await updateDoc(doc(db, 'monthly_configs', configSnapshot.docs[0].id), {
          total_budget_limit: amountInUsd
        });
      } else {
        await addDoc(collection(db, 'monthly_configs'), {
          userId: user.id,
          month: monthStr,
          total_budget_limit: amountInUsd
        });
      }

      toast.success(`Total budget for ${format(currentDate, 'MMMM')} updated!`);
      setIsGlobalLimitModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to update limit');
      fetchData();
    }
  };

  const handleCarryForward = async () => {
    if (!user) return;
    setIsNavigating(true);
    try {
      const prevMonth = subMonths(currentDate, 1);
      const prevMonthStr = format(prevMonth, 'yyyy-MM');
      const currentMonthStr = format(currentDate, 'yyyy-MM');

      // 1. Get previous month budgets
      const prevBudgetsQuery = query(
        collection(db, 'budgets'),
        where('userId', '==', user.id),
        where('month', '==', prevMonthStr)
      );
      
      // 2. Get previous month total limit
      const prevConfigQuery = query(
        collection(db, 'monthly_configs'),
        where('userId', '==', user.id),
        where('month', '==', prevMonthStr)
      );

      const [prevBudgetsSnapshot, prevConfigSnapshot] = await Promise.all([
        getDocs(prevBudgetsQuery),
        getDocs(prevConfigQuery)
      ]);

      if (prevBudgetsSnapshot.empty && prevConfigSnapshot.empty) {
        toast.error('No data found in previous month to carry forward');
        return;
      }

      const promises: any[] = [];

      // Carry forward budgets (only for categories that don't have a budget yet)
      prevBudgetsSnapshot.docs.forEach(bDoc => {
        const data = bDoc.data();
        const alreadyExists = budgets.some(b => b.category === data.category);
        if (!alreadyExists) {
          promises.push(addDoc(collection(db, 'budgets'), {
            userId: user.id,
            category: data.category,
            monthly_limit: data.monthly_limit,
            month: currentMonthStr
          }));
        }
      });

      // Carry forward total limit (only if not already set for current month)
      if (!prevConfigSnapshot.empty) {
        const currentConfigQuery = query(
          collection(db, 'monthly_configs'),
          where('userId', '==', user.id),
          where('month', '==', currentMonthStr)
        );
        const currentConfigSnapshot = await getDocs(currentConfigQuery);
        
        if (currentConfigSnapshot.empty) {
          const configData = prevConfigSnapshot.docs[0].data();
          promises.push(addDoc(collection(db, 'monthly_configs'), {
            userId: user.id,
            month: currentMonthStr,
            total_budget_limit: configData.total_budget_limit,
            savings_rate: configData.savings_rate || 0
          }));
        }
      }

      if (promises.length === 0) {
        toast('Budgets already match previous month', { icon: 'ℹ️' });
      } else {
        await Promise.all(promises);
        toast.success(`Succesfully cloned budgets from ${format(prevMonth, 'MMMM')}!`);
      }
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to carry forward budgets');
    } finally {
      setIsNavigating(false);
    }
  };

  const handleSetSavingsRate = async (rate: number) => {
    if (!user) return;
    const monthStr = format(currentDate, 'yyyy-MM');
    const path = `monthly_configs (month: ${monthStr})`;
    
    try {
      setSavingsRate(rate);

      const configsQuery = query(
        collection(db, 'monthly_configs'),
        where('userId', '==', user.id),
        where('month', '==', monthStr)
      );
      const configSnapshot = await getDocs(configsQuery);

      if (!configSnapshot.empty) {
        const configDoc = configSnapshot.docs[0];
        try {
          await updateDoc(doc(db, 'monthly_configs', configDoc.id), {
            savings_rate: rate
          });
        } catch (updateErr) {
          handleFirestoreError(updateErr, OperationType.UPDATE, `monthly_configs/${configDoc.id}`);
        }
      } else {
        try {
          await addDoc(collection(db, 'monthly_configs'), {
            userId: user.id,
            month: monthStr,
            total_budget_limit: globalBudgetLimit, // Carry over current limit if exists
            savings_rate: rate
          });
        } catch (addErr) {
          handleFirestoreError(addErr, OperationType.CREATE, 'monthly_configs');
        }
      }
      toast.success(`Savings goal set to ${rate === 0 ? 'None' : rate + '%'}`);
      fetchData();
    } catch (err) {
      console.error('Error in handleSetSavingsRate:', err);
      // Detailed logging for debugging
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          console.error('Parsed Firestore Error:', parsed);
        } catch (e) {
          // Not a JSON error, just a standard one
        }
      }
      toast.error('Failed to update savings rate. Please check console for details.');
      fetchData();
    }
  };

  const totalBudgetFromCategories = budgets.reduce((acc, b) => acc + b.monthly_limit, 0);
  
  // A month is considered "Initialized" only if there is a global limit OR at least one category budget
  const isBudgetInitialized = globalBudgetLimit > 0 || budgets.length > 0;
  
  const effectiveTotalBudget = isBudgetInitialized ? (globalBudgetLimit > 0 ? globalBudgetLimit : totalBudgetFromCategories) : 0;
  
  // Savings (Dynamic) and Working Budget logic
  const initialMonthlySavings = effectiveTotalBudget * (savingsRate / 100);
  const workingBudget = effectiveTotalBudget * (1 - (savingsRate / 100));

  const totalSpent = expenses.reduce((acc, exp) => acc + exp.amount, 0);

  // Advanced Overrun Logic - Multi-Tier Funding
  const overrun = Math.max(0, totalSpent - workingBudget);
  const isUtilizingSavings = overrun > 0;
  
  // Current month's savings & Accumulated Savings (Lifetime)
  // Logic: Force Rs 0.00 if budget is not set (isBudgetInitialized is false or effectiveTotalBudget is 0)
  let currentMonthSavingsRemaining = 0;
  let currentTotalLifetimeSavings = 0;

  if (isBudgetInitialized && effectiveTotalBudget > 0) {
    currentMonthSavingsRemaining = initialMonthlySavings - overrun;
    currentTotalLifetimeSavings = lifetimeSavings + currentMonthSavingsRemaining;
  }

  // Multi-Tier Funding: Remaining Cashflow stops at zero
  // It represents the remaining balance of the working budget (Income - Savings %)
  const remainingCashflow = Math.max(0, workingBudget - totalSpent);
  
  const totalPercent = (isBudgetInitialized && workingBudget > 0) ? Math.min((totalSpent / workingBudget) * 100, 100) : 0;

  const getStatusClasses = (percent: number) => {
    if (percent >= 80) return {
      color: 'red-500',
      bg: 'bg-red-500',
      border: 'border-red-500',
      lightBg: 'bg-red-50',
      text: 'text-red-500',
      borderT: 'border-t-red-500'
    };
    if (percent > 40) return {
      color: 'orange-500',
      bg: 'bg-orange-500',
      border: 'border-orange-500',
      lightBg: 'bg-orange-50',
      text: 'text-orange-500',
      borderT: 'border-t-orange-500'
    };
    return {
      color: 'green-500',
      bg: 'bg-green-500',
      border: 'border-green-500',
      lightBg: 'bg-green-50',
      text: 'text-green-500',
      borderT: 'border-t-green-500'
    };
  };

  const totalStatus = getStatusClasses(totalPercent);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header with Title, Description and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-dark tracking-tight">Budgets</h1>
          <p className="text-text-muted text-sm font-medium mt-1">Manage your monthly spending limits by category.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row items-center gap-3 sm:gap-4">
          {/* Standardized Currency Selector */}
          <div className="relative w-full lg:w-auto" ref={currencyDropdownRef}>
            <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100 shadow-sm w-full">
              <button
                onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                className="group flex flex-1 items-center hover:bg-white hover:shadow-sm rounded-lg transition-all active:scale-95 overflow-hidden"
              >
                <div className="p-1.5 text-primary group-hover:bg-primary/5 rounded-lg transition-colors">
                  <Coins size={18} />
                </div>
                <div className="px-2 sm:px-5 py-0.5 flex flex-col items-center flex-1 min-w-[80px] sm:min-w-[120px] border-l border-r border-gray-200/50">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] leading-none mb-1">Currency</span>
                  <div className="flex items-center gap-1">
                    <span className="font-extrabold text-sm text-text-dark">{currency.code}</span>
                    <ChevronDown size={14} className={`text-text-muted transition-transform duration-300 ${isCurrencyDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                <div className="p-1.5 opacity-0"> 
                  <Coins size={18} />
                </div>
              </button>
            </div>

            <AnimatePresence>
              {isCurrencyDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute left-1/2 -translate-x-1/2 mt-2 w-40 bg-white rounded-xl border border-card-border shadow-xl z-50 overflow-hidden"
                >
                  <div className="p-1">
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => {
                          setCurrency(c.code);
                          setIsCurrencyDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                          currency.code === c.code 
                            ? 'bg-primary/10 text-primary font-bold' 
                            : 'hover:bg-gray-50 text-text-dark'
                        }`}
                      >
                        <span>{c.code} ({c.symbol})</span>
                        {currency.code === c.code && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Savings Percentage Selector */}
          <div className="relative w-full lg:w-auto" ref={savingsDropdownRef}>
            <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100 shadow-sm transition-all hover:border-emerald-200 w-full">
              <button
                onClick={() => setIsSavingsDropdownOpen(!isSavingsDropdownOpen)}
                className="group flex flex-1 items-center hover:bg-white hover:shadow-sm rounded-lg transition-all active:scale-95 overflow-hidden"
              >
                <div className="p-1.5 text-emerald-500 group-hover:bg-emerald-50 rounded-lg transition-colors">
                  <PiggyBank size={18} />
                </div>
                <div className="px-2 sm:px-5 py-0.5 flex flex-col items-center flex-1 min-w-[80px] sm:min-w-[120px] border-l border-r border-gray-200/50">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em] leading-none mb-1 text-center">Saving Goal</span>
                  <div className="flex items-center gap-1">
                    <span className="font-extrabold text-sm text-text-dark">{savingsRate === 0 ? 'None' : `${savingsRate}%`}</span>
                    <ChevronDown size={14} className={`text-text-muted transition-transform duration-300 ${isSavingsDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                <div className="p-1.5 opacity-0">
                  <PiggyBank size={18} />
                </div>
              </button>
            </div>

            <AnimatePresence>
              {isSavingsDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute left-1/2 -translate-x-1/2 mt-2 w-40 bg-white rounded-xl border border-card-border shadow-xl z-50 overflow-hidden"
                >
                  <div className="p-1 max-h-60 overflow-y-auto custom-scrollbar">
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => {
                          handleSetSavingsRate(rate);
                          setIsSavingsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                          savingsRate === rate 
                            ? 'bg-emerald-50 text-emerald-600 font-bold' 
                            : 'hover:bg-gray-50 text-text-dark'
                        }`}
                      >
                        <span>{rate === 0 ? 'None' : `${rate}%`}</span>
                        {savingsRate === rate && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Standardized Month Navigation Control */}
          <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100 shadow-sm w-full lg:w-auto col-span-full sm:col-span-2 lg:col-span-1">
            <button 
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-text-muted transition-all disabled:opacity-30"
              disabled={isNavigating}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-2 sm:px-5 flex flex-col items-center flex-1 min-w-[80px] sm:min-w-[120px]">
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] leading-none mb-1">Viewing Month</span>
              <span className="font-extrabold text-sm text-text-dark whitespace-nowrap">{format(currentDate, 'MMM yyyy').toUpperCase()}</span>
            </div>
            <button 
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-text-muted transition-all disabled:opacity-30"
              disabled={isNavigating}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <AnimatePresence>
          {isNavigating && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 bg-white shadow-sm rounded-3xl flex items-center justify-center h-full min-h-[400px]"
            >
              <div className="bg-white p-4 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-3">
                <Loader2 size={24} className="animate-spin text-primary" />
                <span className="font-bold text-sm">Refreshing data...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary Section - Total Monthly Budget, Total Spent, Total Remaining */}
        <div className="mb-4 flex items-center gap-2 text-text-muted">
          <TrendingUp size={16} />
          <span className="text-sm font-bold uppercase tracking-wider">Budget Overview ({format(currentDate, 'MMMM')})</span>
        </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-white border-l-4 border-l-primary relative group min-h-[140px] flex flex-col justify-center"
        >
          <button 
            onClick={() => {
              setGlobalLimitInput((globalBudgetLimit * currency.rate).toFixed(2));
              setIsGlobalLimitModalOpen(true);
            }}
            className="absolute top-4 right-4 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-text-muted hover:text-primary transition-all shadow-sm border border-card-border"
            title="Edit Global Limit"
          >
            <Edit2 size={16} />
          </button>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
              <Wallet size={24} />
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-sm text-text-muted font-medium">Monthly Budget</p>
              <h3 className="text-2xl font-bold text-text-dark pt-0.5">{formatAmount(workingBudget)}</h3>
              <p className="text-[10px] text-text-muted italic py-0">{100 - savingsRate}% of {formatAmount(effectiveTotalBudget)} Total</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`card bg-white border-l-4 min-h-[140px] flex flex-col justify-center ${currentMonthSavingsRemaining < 0 ? 'border-l-red-500' : isUtilizingSavings ? 'border-l-orange-400' : 'border-l-emerald-500'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl shrink-0 ${currentMonthSavingsRemaining < 0 ? 'bg-red-50 text-red-600' : isUtilizingSavings ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <PiggyBank size={24} />
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-sm text-text-muted font-medium">Monthly Savings ({savingsRate}%)</p>
              <h3 className={`text-2xl font-bold pt-0.5 ${currentMonthSavingsRemaining < 0 ? 'text-red-500' : isUtilizingSavings ? 'text-orange-600' : 'text-text-dark'}`}>
                {formatAmount(Math.max(0, currentMonthSavingsRemaining))}
              </h3>
              
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider leading-none">
                  Life-time Total Savings
                </p>
                <p className={`text-sm font-bold mt-1 ${currentTotalLifetimeSavings < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {formatAmount(currentTotalLifetimeSavings)}
                </p>
              </div>

              {isUtilizingSavings && currentMonthSavingsRemaining > 0 && (
                <p className="text-[10px] text-orange-500 italic pt-1 font-medium pb-0">
                  Safety net active: -{formatAmount(overrun)}
                </p>
              )}
               {currentMonthSavingsRemaining <= 0 && isUtilizingSavings && (
                <p className="text-[10px] text-red-500 italic pt-1 font-bold pb-0">
                  Savings buffer exhausted!
                </p>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`card bg-white border-l-4 min-h-[140px] flex flex-col justify-center ${totalStatus.border}`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl shrink-0 ${totalStatus.lightBg} ${totalStatus.text}`}>
              <TrendingUp size={24} />
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-sm text-text-muted font-medium">Total Spent</p>
              <h3 className="text-2xl font-bold text-text-dark pt-0.5">{formatAmount(totalSpent)}</h3>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full ${totalStatus.bg} transition-all duration-1000`}
                style={{ width: `${totalPercent}%` }}
              />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`card bg-white border-l-4 min-h-[140px] flex flex-col justify-center ${remainingCashflow === 0 ? 'border-l-orange-400' : 'border-l-indigo-500'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl shrink-0 ${remainingCashflow === 0 ? 'bg-orange-50 text-orange-600' : 'bg-indigo-50 text-indigo-600'}`}>
              <TrendingDown size={24} />
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-sm text-text-muted font-medium">Remaining Cashflow</p>
              <h3 className={`text-2xl font-bold pt-0.5 ${remainingCashflow === 0 ? 'text-orange-600' : 'text-text-dark'}`}>
                {formatAmount(remainingCashflow)}
                {remainingCashflow === 0 && <span className="text-sm ml-2 font-medium">(Exhausted)</span>}
              </h3>
              <p className="text-[10px] text-text-muted italic py-0">
                {remainingCashflow === 0 ? 'Using savings for expenses' : 'Funds available in budget'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="flex justify-end items-center mb-8">
        <div className="flex gap-3">
          <button 
            onClick={() => setIsManageModalOpen(true)} 
            className="btn-secondary flex items-center gap-2"
          >
            <Edit2 size={20} />
            Manage All
          </button>
          <button 
            onClick={() => { 
              setEditingId(null); 
              const suggestion = getSuggestion();
              setFormData(suggestion);
              setIsModalOpen(true); 
            }} 
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Set Budget
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {isBudgetInitialized ? (
          budgets.length > 0 ? (
            budgets.map((budget, index) => {
              const actual = actuals.find(a => a.category === budget.category)?.amount || 0;
              const percent = (actual / budget.monthly_limit) * 100;
              const clampedPercent = Math.min(percent, 100);
              const status = getStatusClasses(percent);
              const isOver = actual > budget.monthly_limit;
              const remaining = budget.monthly_limit - actual;

              return (
                <motion.div 
                  key={budget.id} 
                  initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`card group hover:shadow-lg transition-all duration-300 border-t-4 ${status.borderT}`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl transition-colors ${status.lightBg} ${status.text}`}>
                        {categoryIcons[budget.category] || <Target size={20} />}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-text-dark">{budget.category}</h3>
                        <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Monthly Budget</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEdit(budget)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-text-muted hover:text-primary transition-colors"
                        title="Edit Budget"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(budget.id)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-text-muted hover:text-red-500 transition-colors"
                        title="Delete Budget"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-2xl font-bold text-text-dark">{formatAmount(actual)}</p>
                        <p className="text-xs text-text-muted">of {formatAmount(budget.monthly_limit)} spent</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${status.text}`}>
                          {percent.toFixed(0)}%
                        </p>
                        <p className="text-[10px] text-text-muted uppercase font-bold">Used</p>
                      </div>
                    </div>

                    <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${clampedPercent}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full ${status.bg}`}
                      />
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                      <div className="flex items-center gap-1.5">
                        {isOver ? (
                          <div className={`flex items-center gap-1 text-xs ${status.text} font-bold`}>
                            <AlertCircle size={14} />
                            <span>Over by {formatAmount(Math.abs(remaining))}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-text-muted">
                            <span className={`font-bold ${status.text}`}>{formatAmount(remaining)}</span> remaining
                          </div>
                        )}
                      </div>
                      {percent >= 80 && !isOver && (
                        <span className={`text-[10px] ${status.lightBg} ${status.text} px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter`}>
                          Nearing Limit
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="col-span-full py-20 text-center card bg-white border-dashed border-2">
              <div className="max-w-xs mx-auto">
                <div className="w-12 h-12 bg-primary/5 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus size={24} />
                </div>
                <h3 className="font-bold text-text-dark mb-1">No Categories Set</h3>
                <p className="text-xs text-text-muted mb-6">You've set a total limit but haven't allocated it to categories yet.</p>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="btn-primary w-full py-2 text-sm"
                >
                  Allocate Categories
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="col-span-full py-16 text-center card bg-gradient-to-b from-gray-50/50 to-white border-dashed border-2 border-gray-200">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100 ring-8 ring-gray-50">
                <Target size={32} className="text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-text-dark mb-2">Initialize {format(currentDate, 'MMMM')} Budget</h3>
              <p className="text-text-muted mb-8 text-sm leading-relaxed px-4">
                This month hasn't been planned yet. You can start fresh or carry forward your settings from last month.
              </p>
              
              <div className="flex justify-center px-6">
                <button 
                  onClick={handleCarryForward}
                  disabled={isNavigating}
                  className="btn-secondary flex items-center justify-center gap-2 px-6 py-2.5 text-sm whitespace-nowrap"
                >
                  <TrendingUp size={18} />
                  Carry Forward from {format(subMonths(currentDate, 1), 'MMM')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div></div>

      {/* Currency Settings at the Bottom */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-8 border-t border-card-border mt-8"
      >
        <p className="text-xs text-text-muted font-bold uppercase tracking-widest mb-4">Quick Currency Switch</p>
        <div className="flex flex-wrap justify-center gap-2">
          {SUPPORTED_CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => setCurrency(c.code)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                currency.code === c.code 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'bg-white border border-card-border text-text-muted hover:border-primary/50'
              }`}
            >
              {c.code} ({c.symbol})
            </button>
          ))}
        </div>
      </motion.div>

      <Modal isOpen={isManageModalOpen} onClose={() => setIsManageModalOpen(false)} title="Manage All Budgets">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {categories.map(category => {
            const budget = budgets.find(b => b.category === category);
            return (
              <div key={category} className="flex items-center justify-between p-3 rounded-xl border border-card-border hover:border-primary/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/5 text-primary">
                    {categoryIcons[category]}
                  </div>
                  <span className="font-bold text-text-dark">{category}</span>
                </div>
                <div className="flex items-center gap-2">
                  {budget ? (
                    <>
                      <span className="text-sm font-bold text-primary">{formatAmount(budget.monthly_limit)}</span>
                      <button 
                        onClick={() => {
                          handleEdit(budget);
                          setIsManageModalOpen(false);
                        }}
                        className="p-2 rounded-lg hover:bg-gray-100 text-text-muted hover:text-primary"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => {
                          handleDeleteClick(budget.id);
                          setIsManageModalOpen(false);
                        }}
                        className="p-2 rounded-lg hover:bg-gray-100 text-text-muted hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => {
                        setFormData({ category, limit: '' });
                        setIsModalOpen(true);
                        setIsManageModalOpen(false);
                      }}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <Plus size={12} />
                      Set Limit
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      <Modal isOpen={isGlobalLimitModalOpen} onClose={() => setIsGlobalLimitModalOpen(false)} title="Edit Monthly Budget Limit">
        <form onSubmit={handleSetGlobalLimit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Total Monthly Budget / Salary ({currency.code})</label>
            <div className="flex items-center w-full px-4 py-2.5 rounded-xl border border-card-border focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all bg-white shadow-sm">
              <span className="text-text-muted font-bold pr-2 shrink-0 border-r border-gray-100 mr-2">
                {currency.symbol}
              </span>
              <input
                type="number"
                required
                step="0.01"
                className="w-full focus:outline-none bg-transparent text-text-dark font-medium"
                placeholder="0.00"
                value={globalLimitInput}
                onChange={(e) => setGlobalLimitInput(e.target.value)}
              />
            </div>
            <p className="text-xs text-text-muted mt-2">
              Setting this will override the sum of category budgets as your primary target. Set to 0 to use the sum of categories.
            </p>
          </div>
          <button type="submit" className="btn-primary w-full mt-2">
            Update Global Limit
          </button>
        </form>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingId ? "Edit Budget" : "Set Budget"}>
        <form onSubmit={handleSetBudget} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Category</label>
            <select
              className="input-field"
              disabled={!!editingId}
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {editingId && <p className="text-xs text-text-muted mt-1">Category cannot be changed for an existing budget.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Monthly Limit ({currency.code})</label>
            <div className="flex items-center w-full px-4 py-2.5 rounded-xl border border-card-border focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all bg-white shadow-sm">
              <span className="text-text-muted font-bold pr-2 shrink-0 border-r border-gray-100 mr-2">
                {currency.symbol}
              </span>
              <input
                type="number"
                required
                step="0.01"
                className="w-full focus:outline-none bg-transparent text-text-dark font-medium"
                placeholder="0.00"
                value={formData.limit}
                onChange={(e) => setFormData({ ...formData, limit: e.target.value })}
              />
            </div>
            {!editingId && expenses.length > 0 && (
              <p className="text-[10px] text-primary font-bold uppercase mt-1 flex items-center gap-1">
                <TrendingUp size={12} />
                Suggested based on your spending history
              </p>
            )}
          </div>
          <div className="flex gap-3 mt-2">
            {editingId && (
              <button 
                type="button"
                onClick={() => {
                  setDeletingId(editingId);
                  setIsModalOpen(false);
                  setIsDeleteModalOpen(true);
                }}
                className="btn-secondary border-red-200 text-red-500 hover:bg-red-50 flex-1"
              >
                Remove
              </button>
            )}
            <button type="submit" className={`btn-primary ${editingId ? 'flex-[2]' : 'w-full'}`}>
              {editingId ? 'Update Budget' : 'Save Budget'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Remove Budget">
        <div className="space-y-4">
          <p className="text-text-muted">Are you sure you want to remove this budget? This will stop tracking limits for this category.</p>
          <div className="flex gap-3">
            <button onClick={() => setIsDeleteModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={confirmDelete} className="btn-primary bg-red-500 hover:bg-red-600 border-red-500 flex-1">Remove</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Budgets;
