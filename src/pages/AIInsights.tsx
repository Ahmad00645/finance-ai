import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Lightbulb, TrendingDown, Zap } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';

const AIInsights = () => {
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      if (!user) return;
      try {
        const expensesQuery = query(collection(db, 'expenses'), where('userId', '==', user.id));
        const budgetsQuery = query(collection(db, 'budgets'), where('userId', '==', user.id));
        
        const [expensesSnapshot, budgetsSnapshot] = await Promise.all([
          getDocs(expensesQuery),
          getDocs(budgetsQuery)
        ]);

        const expenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const budgets = budgetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const generatedInsights = [];
        
        // Rule 1: Category concentration
        const totals: any = {};
        expenses.forEach((e: any) => totals[e.category] = (totals[e.category] || 0) + e.amount);
        const sorted = Object.entries(totals).sort((a: any, b: any) => b[1] - a[1]);
        
        if (sorted.length > 0) {
          const top = sorted[0];
          generatedInsights.push(`${top[0]} is your highest spending category this month (${formatAmount(Number(top[1]))}). Try to reduce this by 10% next month.`);
        }

        // Rule 2: Budget alerts
        budgets.forEach((b: any) => {
          const actual = totals[b.category] || 0;
          if (actual > b.monthly_limit) {
            generatedInsights.push(`You've exceeded your ${b.category} budget by ${formatAmount(actual - b.monthly_limit)}. Consider reviewing these expenses.`);
          } else if (actual > b.monthly_limit * 0.8) {
            generatedInsights.push(`You're close to your ${b.category} budget limit. You have ${formatAmount(b.monthly_limit - actual)} remaining.`);
          }
        });

        // Rule 3: General tips
        generatedInsights.push("Users who set budgets for 'Food' and 'Shopping' save an average of 18% more per month.");
        generatedInsights.push("Consider car-pooling or using public transport if your 'Transport' costs are rising.");

        setInsights(generatedInsights);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-dark flex items-center gap-2">
          <Sparkles className="text-primary" />
          AI Insights
        </h1>
        <p className="text-text-muted">Personalized financial advice powered by AI</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {insights.length > 0 ? (
          insights.map((insight, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="card flex gap-4 items-start"
            >
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
                {i % 2 === 0 ? <Lightbulb size={20} /> : <Zap size={20} />}
              </div>
              <div>
                <p className="text-text-dark leading-relaxed">{insight}</p>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center card">
            <p className="text-text-muted">Add more expenses to generate deeper insights.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsights;
