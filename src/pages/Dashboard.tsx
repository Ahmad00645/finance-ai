import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Tag, Target, Sparkles, ArrowRight, Globe, ChevronDown, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../AuthContext';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Link } from 'react-router-dom';
import { useCurrency, SUPPORTED_CURRENCIES } from '../contexts/CurrencyContext';
import FinanceChatboard from '../components/FinanceChatboard';
import { format, startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths } from 'date-fns';

ChartJS.register(ArcElement, Tooltip, Legend);

const Dashboard = () => {
  const { user } = useAuth();
  const { currency, setCurrency, formatAmount, convertAmount } = useCurrency();
  const [summary, setSummary] = useState({ total: 0, categories: 0, budgets: 0 });
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isNavigating, setIsNavigating] = useState(false);

  const handlePrevMonth = () => {
    setIsNavigating(true);
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    if (isSameMonth(currentDate, new Date())) return;
    setIsNavigating(true);
    setCurrentDate(prev => addMonths(prev, 1));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setError(null);
      setLoading(true);
      try {
        const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
        const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');
        const monthStr = format(currentDate, 'yyyy-MM');

        const expensesQuery = query(
          collection(db, 'expenses'), 
          where('userId', '==', user.id),
          where('date', '>=', start),
          where('date', '<=', end)
        );
        
        const budgetsQuery = query(
          collection(db, 'budgets'), 
          where('userId', '==', user.id),
          where('month', '==', monthStr)
        );
        
        const [expensesSnapshot, budgetsSnapshot] = await Promise.all([
          getDocs(expensesQuery).catch(e => handleFirestoreError(e, OperationType.LIST, 'expenses')),
          getDocs(budgetsQuery).catch(e => handleFirestoreError(e, OperationType.LIST, 'budgets'))
        ]);

        if (!expensesSnapshot || !budgetsSnapshot) return;

        const expenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const budgets = budgetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const totalSpent = expenses.reduce((sum, exp: any) => sum + exp.amount, 0);
        const categories = new Set(expenses.map((exp: any) => exp.category)).size;

        setSummary({
          total: totalSpent,
          categories: categories,
          budgets: budgets.length
        });

        const categoryTotals: Record<string, number> = {};
        expenses.forEach((exp: any) => {
          categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
        });
        const catData = Object.entries(categoryTotals).map(([category, amount]) => ({ category, amount }));
        setCategoryData(catData);

      } catch (err) {
        console.error(err);
        setError("Failed to connect to the database. Please check your internet connection.");
      } finally {
        setLoading(false);
        setIsNavigating(false);
      }
    };
    fetchData();
  }, [user, currentDate]);

  const chartData = {
    labels: categoryData.map(c => c.category),
    datasets: [{
      data: categoryData.map(c => convertAmount(c.amount)),
      backgroundColor: [
        '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84cc16', '#6366F1', '#f97316', '#14b8a6'
      ],
      borderWidth: 0,
    }]
  };

  const topCategory = categoryData.length > 0 
    ? categoryData.reduce((prev, current) => (prev.amount > current.amount) ? prev : current)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-text-dark mb-2">Welcome back!</h1>
          <p className="text-text-muted">Here's your financial overview</p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-xl text-sm flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
          {/* Standardized Month Navigation Control */}
          <div className="flex items-center bg-gray-50 pt-0 pb-0 px-0 rounded-xl border border-gray-100 shadow-sm w-[218.6px] h-[44.6px] flex-shrink-0">
            <button 
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-text-muted transition-all active:scale-90 disabled:opacity-30"
              disabled={isNavigating}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-2 sm:px-5 flex flex-col items-center flex-1 min-w-[80px] sm:min-w-[120px] border-l border-r border-gray-200/50">
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] leading-none mb-1">Period</span>
              <span className="font-bold text-sm text-text-dark whitespace-nowrap">
                {format(currentDate, 'MMM yyyy').toUpperCase()}
              </span>
            </div>
            <button 
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-text-muted transition-all active:scale-90 disabled:opacity-30"
              disabled={isNavigating || isSameMonth(currentDate, new Date())}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 bg-white px-4 pt-[14px] pb-[14px] h-[45px] w-[196.312px] rounded-xl border border-card-border shadow-sm hover:border-primary/50 transition-all active:scale-95"
            >
            <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
              <Globe size={18} />
            </div>
            <div className="text-left flex flex-col">
              <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider leading-none mb-1">Currency</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{currency.code} ({currency.symbol})</span>
                <ChevronDown size={14} className={`text-text-muted transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </button>

          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-card-border shadow-xl z-50 overflow-hidden pl-[1px] pr-0"
              >
                <div className="p-2">
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => {
                        setCurrency(c.code);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        currency.code === c.code 
                          ? 'bg-primary/10 text-primary font-bold' 
                          : 'hover:bg-gray-50 text-text-dark'
                      }`}
                    >
                      <span>{c.code} ({c.symbol})</span>
                      {currency.code === c.code && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
        {[
          { label: 'Total Expenses', value: formatAmount(summary.total), icon: Wallet, color: 'text-teal-500', bg: 'bg-teal-50' },
          { label: 'Categories', value: summary.categories, icon: Tag, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Active Budgets', value: summary.budgets, icon: Target, color: 'text-purple-500', bg: 'bg-purple-50' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className={`card flex items-center justify-between p-4 sm:p-6 ${i === 2 ? 'px-0 sm:px-0' : ''}`}
          >
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm text-text-muted mb-1">{stat.label}</span>
              <span className="text-xl sm:text-2xl font-bold">{stat.value}</span>
            </div>
            <div className={`w-10 h-10 sm:w-12 sm:h-12 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center shrink-0 ml-2`}>
              <stat.icon size={20} className="sm:w-[24px] sm:h-[24px]" />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 space-y-6"
        >
          <div className="card">
            <div className="flex items-center gap-2 text-primary font-bold mb-4">
              <Sparkles size={20} />
              AI Insight
            </div>
            <p className="text-sm sm:text-base text-text-muted">
              {topCategory 
                ? `You've spent most on ${topCategory.category} this month (${formatAmount(topCategory.amount)}). Consider setting a budget to save up to 15%.`
                : "Start tracking your expenses to get personalized insights!"}
            </p>
            <Link to="/insights" className="inline-flex items-center gap-1 text-primary text-sm font-medium mt-4 hover:underline">
              View all insights <ArrowRight size={14} />
            </Link>
          </div>

          <div className="card">
            <h3 className="font-bold mb-6">Spending by Category</h3>
            <div className="h-[250px] sm:h-[300px] flex items-center justify-center">
              {categoryData.length > 0 ? (
                <Pie 
                  data={chartData} 
                  options={{ 
                    maintainAspectRatio: false,
                    plugins: { 
                      legend: { 
                        position: window.innerWidth < 640 ? 'bottom' : 'right',
                        labels: {
                          boxWidth: 12,
                          padding: 15,
                          font: { size: 11 }
                        }
                      } 
                    }
                  }} 
                />
              ) : (
                <p className="text-text-muted">No data to display yet</p>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="card">
            <h3 className="font-bold mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {/* This would ideally be a subset of expenses */}
              <p className="text-sm text-text-muted italic">Check the Expenses tab for your full history.</p>
              <Link to="/expenses" className="btn-primary w-full text-center block text-sm">
                View Expenses
              </Link>
            </div>
          </div>

          <FinanceChatboard context={{ summary, categoryData }} />
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
