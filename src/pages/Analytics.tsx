import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../AuthContext';
import { Download, FileText, ChevronLeft, ChevronRight, Calendar, Loader2, TrendingUp, Target, PieChart as PieChartIcon, BarChart3 as BarChartIcon, Activity } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isSameMonth, isAfter } from 'date-fns';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84cc16', '#6366F1', '#f97316', '#14b8a6'];

const Analytics = () => {
  const { user } = useAuth();
  const { convertAmount, currency, formatAmount } = useCurrency();
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [currentMonthExpenses, setCurrentMonthExpenses] = useState<any[]>([]);
  const [budgetVsActual, setBudgetVsActual] = useState<any[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [monthlyConfig, setMonthlyConfig] = useState<{ limit: number, rate: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const handlePrevMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    const nextDate = addMonths(currentDate, 1);
    if (isAfter(nextDate, new Date()) && !isSameMonth(nextDate, new Date())) {
      toast.error("Cannot navigate to future months");
      return;
    }
    setCurrentDate(nextDate);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setIsNavigating(true);
      try {
        const monthStr = format(currentDate, 'yyyy-MM');
        const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
        const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

        const expensesQuery = query(
          collection(db, 'expenses'), 
          where('userId', '==', user.id),
          where('date', '>=', start),
          where('date', '<=', end)
        );
        
        // STRICT FILTERING: Only fetch budgets for THIS specific month
        const budgetsQuery = query(
          collection(db, 'budgets'), 
          where('userId', '==', user.id),
          where('month', '==', monthStr)
        );

        // Fetch monthly config for Income and Savings Rate
        const configQuery = query(
          collection(db, 'monthly_configs'),
          where('userId', '==', user.id),
          where('month', '==', monthStr)
        );
        
        const trendQuery = query(
          collection(db, 'expenses'), 
          where('userId', '==', user.id),
          orderBy('date', 'desc')
        );

        const [expensesSnapshot, budgetsSnapshot, configSnapshot, trendSnapshot] = await Promise.all([
          getDocs(expensesQuery),
          getDocs(budgetsQuery),
          getDocs(configQuery),
          getDocs(trendQuery)
        ]);

        const expenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => (a as any).date.localeCompare((b as any).date));
        setCurrentMonthExpenses(expenses);
        const budgets = budgetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const configData = configSnapshot.empty ? null : configSnapshot.docs[0].data();
        const allExpenses = trendSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        setMonthlyConfig(configData ? { 
          limit: configData.total_budget_limit || 0, 
          rate: configData.savings_rate || 0 
        } : null);

        // Process Category Data
        const categoryTotals: Record<string, number> = {};
        expenses.forEach((exp: any) => {
          categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
        });
        const catData = Object.entries(categoryTotals).map(([category, amount]) => ({ category, amount }));
        setCategoryData(catData);

        // Process Budget vs Actual
        const bvaData = budgets.map((b: any) => {
          const actual = categoryTotals[b.category] || 0;
          return {
            category: b.category,
            limit: b.monthly_limit,
            actual
          };
        });
        setBudgetVsActual(bvaData);

        // Process Monthly Trend
        const monthlyTotals: Record<string, number> = {};
        allExpenses.forEach((exp: any) => {
          const month = exp.date.substring(0, 7); // YYYY-MM
          monthlyTotals[month] = (monthlyTotals[month] || 0) + exp.amount;
        });
        const trendData = Object.entries(monthlyTotals)
          .map(([month, total]) => ({ month, total }))
          .sort((a, b) => a.month.localeCompare(b.month))
          .slice(-6);
        setMonthlyTrend(trendData);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setIsNavigating(false);
      }
    };
    fetchData();
  }, [user, currentDate]);

  const pieChartData = categoryData.map(c => ({
    name: c.category,
    value: convertAmount(c.amount)
  }));

  const barChartData = budgetVsActual.map(b => ({
    name: b.category,
    budget: convertAmount(b.limit),
    actual: convertAmount(b.actual)
  }));

  const lineChartData = monthlyTrend.map(t => ({
    name: t.month,
    total: convertAmount(t.total)
  }));

  const formatCurrency = (value: number) => `${currency.symbol} ${value.toLocaleString()}`;

  const totalExpense = categoryData.reduce((sum, item) => sum + item.amount, 0);
  const topCategory = categoryData.length > 0 
    ? categoryData.reduce((prev, current) => (prev.amount > current.amount) ? prev : current)
    : null;

  const getAdvice = () => {
    if (!topCategory) return "Start tracking your expenses to get personalized advice.";
    return `Your highest spending category is ${topCategory.category} with a total of ${formatAmount(topCategory.amount)}. To improve your savings, we recommend reducing your ${topCategory.category} expenses by at least 10% for the next month.`;
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF();
      const advice = getAdvice();
      const monthTitle = format(currentDate, 'MMMM yyyy');

      // Income and Working Budget logic
      const income = monthlyConfig?.limit || 0;
      const rate = monthlyConfig?.rate || 0;
      const savingsGoal = income * (rate / 100);
      const workingBudget = income * (1 - (rate / 100));

      // Header
      doc.setFontSize(22);
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.text("FinanceAI Monthly Report", 14, 22);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Reporting Month: ${monthTitle}`, 14, 30);
      doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 36);
      
      // Financial Overview (Key Metrics)
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("1. Financial Summary", 14, 50);
      
      autoTable(doc, {
        startY: 55,
        body: [
          ["Total Monthly Income (Limit)", formatAmount(income)],
          ["Savings Goal set", `${rate}%`],
          ["Target Savings Amount", formatAmount(savingsGoal)],
          ["Calculated Working Budget", formatAmount(workingBudget)],
          ["Actual Total Spent", formatAmount(totalExpense)],
          ["Remaining Balance", formatAmount(workingBudget - totalExpense)]
        ],
        theme: 'plain',
        styles: { fontSize: 11, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
      });
      
      let nextY = (doc as any).lastAutoTable.finalY + 15;

      // Category Breakdown
      doc.setFontSize(14);
      doc.text("2. Spending by Category", 14, nextY);
      
      autoTable(doc, {
        startY: nextY + 5,
        head: [['Category', 'Actual Spending', '% of Total']],
        body: categoryData.map(c => [
          c.category, 
          formatAmount(c.amount), 
          `${totalExpense > 0 ? ((c.amount / totalExpense) * 100).toFixed(1) : '0'}%`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] }
      });
      
      nextY = (doc as any).lastAutoTable.finalY + 15;

      // Budget vs Actual
      if (budgetVsActual.length > 0) {
        if (nextY > 240) { doc.addPage(); nextY = 20; }
        doc.setFontSize(14);
        doc.text("3. Budget vs Actual Comparison", 14, nextY);
        
        autoTable(doc, {
          startY: nextY + 5,
          head: [['Category', 'Monthly Limit', 'Actual Spent', 'Status']],
          body: budgetVsActual.map(b => {
            const diff = b.limit - b.actual;
            const status = diff >= 0 ? "Under Budget" : "Over Budget";
            return [
              b.category,
              formatAmount(b.limit),
              formatAmount(b.actual),
              status
            ];
          }),
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] }
        });
        nextY = (doc as any).lastAutoTable.finalY + 15;
      }
      
      // Detailed Transaction Log (Line Item spending)
      if (currentMonthExpenses.length > 0) {
        if (nextY > 230) { doc.addPage(); nextY = 20; }
        doc.setFontSize(14);
        doc.text("4. Detailed Transaction Log", 14, nextY);
        
        autoTable(doc, {
          startY: nextY + 5,
          head: [['Date', 'Description', 'Category', 'Amount']],
          body: currentMonthExpenses.map(e => [
            format(new Date(e.date), 'MMM dd, yyyy'),
            e.description || '-',
            e.category,
            formatAmount(e.amount)
          ]),
          theme: 'striped',
          headStyles: { fillColor: [71, 85, 105] }, // Slate-600
          styles: { fontSize: 9 },
          columnStyles: {
            3: { halign: 'right', fontStyle: 'bold' }
          }
        });
        nextY = (doc as any).lastAutoTable.finalY + 15;
      }
      
      // AI Financial Insights
      if (nextY > 230) { doc.addPage(); nextY = 20; }
      doc.setFontSize(14);
      doc.text("5. AI Financial Insights", 14, nextY);
      
      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      const splitAdvice = doc.splitTextToSize(advice, 180);
      doc.text(splitAdvice, 14, nextY + 10);
      
      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount} - FinanceAI Secure Personal Banking`, 105, 290, { align: 'center' });
      }

      doc.save(`FinanceAI_Report_${format(currentDate, 'yyyy_MM')}.pdf`);
      toast.success("Detailed PDF Report generated!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate PDF Report");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-dark">Analytics</h1>
          <p className="text-text-muted text-sm mt-1 font-medium">Detailed overview of your financial activity</p>
        </div>

        {/* Month Selector and Export PDF Container */}
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full md:w-auto justify-end">
          {/* Month Selector */}
          <div className="flex items-center bg-white p-1 rounded-2xl border border-card-border shadow-sm w-full sm:w-auto overflow-hidden">
            <button 
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-50 text-text-muted transition-all active:scale-90 disabled:opacity-30"
              disabled={isNavigating}
            >
              <ChevronLeft size={20} />
            </button>
            <div className="px-4 py-1 flex flex-col items-center flex-1 sm:min-w-[140px] border-l border-r border-gray-100/50">
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] leading-none mb-1">Period</span>
              <span className="text-xs sm:text-sm font-extrabold text-text-dark whitespace-nowrap">{format(currentDate, 'MMM yyyy').toUpperCase()}</span>
            </div>
            <button 
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-50 text-text-muted transition-all active:scale-90 disabled:opacity-30"
              disabled={isNavigating || (isSameMonth(currentDate, new Date()))}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <button 
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-2xl text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:translate-y-[-2px] transition-all active:scale-95 whitespace-nowrap w-full sm:w-auto justify-center"
          >
            <Download size={18} />
            GENERATE REPORT
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
        <AnimatePresence>
          {isNavigating && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 bg-white shadow-sm rounded-3xl flex items-center justify-center"
            >
              <div className="bg-white p-4 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-3">
                <Loader2 size={24} className="animate-spin text-primary" />
                <span className="font-bold text-sm">Refreshing data...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="card border-none shadow-xl shadow-blue-500/5 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <PieChartIcon size={22} />
            </div>
            <div>
              <h3 className="font-bold text-text-dark">Spending Distribution</h3>
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Expense share</p>
            </div>
          </div>
          <div className="h-[280px] sm:h-[320px]">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={1500}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => formatCurrency(value)} 
                  />
                  <RechartsLegend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                <Calendar className="text-gray-300 mb-2" size={40} />
                <p className="text-text-muted font-medium">No spending found for {format(currentDate, 'MMMM')}</p>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.4 }} className="card border-none shadow-xl shadow-blue-500/5 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <BarChartIcon size={22} />
            </div>
            <div>
              <h3 className="font-bold text-text-dark">Budget vs Actual</h3>
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Target tracking</p>
            </div>
          </div>
          <div className="h-[280px] sm:h-[320px]">
            {barChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" strokeOpacity={0.4} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} tickFormatter={(value) => `${currency.symbol} ${value}`} dx={-10} />
                  <RechartsTooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => formatCurrency(value)} 
                  />
                  <RechartsLegend verticalAlign="top" align="right" height={36} />
                  <Bar dataKey="budget" name="Budget" fill="#F1F5F9" radius={[6, 6, 0, 0]} barSize={20} animationDuration={1500} />
                  <Bar dataKey="actual" name="Actual" fill="#12B981" radius={[6, 6, 0, 0]} barSize={20} animationDuration={1500} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                <Target className="text-gray-300 mb-2" size={40} />
                <p className="text-text-muted font-medium">Set budgets to see comparison tracking</p>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} className="card border-none shadow-xl shadow-blue-500/5 bg-white/80 backdrop-blur-sm lg:col-span-2">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Activity size={22} />
            </div>
            <div>
              <h3 className="font-bold text-text-dark">Monthly Trend (Last 6 Months)</h3>
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Historical performance</p>
            </div>
          </div>
          <div className="h-[280px] sm:h-[320px]">
            {lineChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" strokeOpacity={0.4} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} tickFormatter={(value) => `${currency.symbol} ${value}`} dx={-10} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => formatCurrency(value)} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    name="Total Expenses" 
                    stroke="#12B981" 
                    strokeWidth={4} 
                    dot={{ r: 6, fill: '#12B981', strokeWidth: 3, stroke: '#fff' }}
                    activeDot={{ r: 8, strokeWidth: 0, fill: '#12B981' }}
                    animationDuration={2000}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                <TrendingUp className="text-gray-300 mb-2 opacity-30" size={40} />
                <p className="text-text-muted font-medium">More data needed to calculate trends</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Analytics;
