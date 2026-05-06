import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, TrendingUp, BarChart3, ShieldCheck, ChevronRight, CheckCircle2, Wallet, ArrowUpRight, ArrowDownRight, CreditCard, ShoppingBag, Coffee, Target, ArrowRight, Bot, Camera } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import Modal from '../components/Modal';
import AuthForm from '../components/AuthForm';

const HomePage = () => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const authAction = searchParams.get('auth');
    if (authAction === 'login' || authAction === 'register') {
      setAuthMode(authAction);
      setIsAuthModalOpen(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('auth');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const features = [
    { title: 'AI Categorization', desc: 'Automatically categorize expenses with GPT-powered intelligence.', icon: Sparkles, color: 'text-teal-500', bg: 'bg-teal-50' },
    { title: 'Smart Insights', desc: 'Get personalized spending insights and saving tips.', icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50' },
    { title: 'Visual Analytics', desc: 'Beautiful charts and reports to understand your money.', icon: BarChart3, color: 'text-purple-500', bg: 'bg-purple-50' },
    { title: 'Budget Tracking', desc: 'Set and monitor spending limits for every category.', icon: ShieldCheck, color: 'text-orange-500', bg: 'bg-orange-50' },
    { title: 'Ai Assistant', desc: 'Chat with your personal financial advisor for instant help.', icon: Bot, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { title: 'Scan Receipt', desc: 'Just snap a photo of your receipt to log expenses instantly.', icon: Camera, color: 'text-rose-500', bg: 'bg-rose-50' },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="pt-20 pb-32 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-text-dark mb-6 tracking-tight">
            Smart Money, <span className="text-primary">Smarter Decisions</span>
          </h1>
          <p className="text-xl text-text-muted mb-10 max-w-2xl mx-auto">
            AI-powered expense tracking and budget management that helps you take control of your finances with ease and precision.
          </p>
          <div className="flex justify-center">
            <button
              onClick={() => openAuth('register')}
              className="btn-primary text-lg px-8 py-3 rounded-full shadow-lg shadow-primary/20"
            >
              Get Started Free
            </button>
          </div>
        </motion.div>

        {/* Feature Cards */}
        <div className="max-w-7xl mx-auto mt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 + 0.4 }}
              className="card text-left hover:translate-y-[-4px] transition-transform duration-300"
            >
              <div className={`w-12 h-12 ${f.bg} ${f.color} rounded-xl flex items-center justify-center mb-4`}>
                <f.icon size={24} />
              </div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-text-muted text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-white/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-text-muted">Three simple steps to financial freedom</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { step: '01', title: 'Connect & Log', desc: 'Add your daily expenses manually or import them. Our AI handles the heavy lifting.' },
              { step: '02', title: 'Analyze', desc: 'See where your money goes with beautiful, interactive charts and category breakdowns.' },
              { step: '03', title: 'Optimize', desc: 'Receive AI-driven insights to cut unnecessary costs and grow your savings.' },
            ].map((s, i) => (
              <div key={i} className="relative">
                <div className="text-6xl font-black text-primary mb-4">{s.step}</div>
                <h3 className="text-xl font-bold mb-2">{s.title}</h3>
                <p className="text-text-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App Preview */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-2xl border border-card-border overflow-hidden">
          <div className="bg-gray-50 border-b border-card-border p-4 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 max-w-md mx-auto h-6 bg-white rounded-md border border-card-border flex items-center px-3">
              <div className="w-full h-2 bg-gray-100 rounded-full" />
            </div>
          </div>
          <div className="p-8 bg-gray-50/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl border border-card-border shadow-sm">
                <div className="text-sm text-text-muted mb-1">Total Balance</div>
                <div className="text-2xl font-bold">$12,450.00</div>
                <div className="text-xs text-green-500 mt-1 flex items-center gap-1">
                  <ArrowUpRight size={12} /> +12% from last month
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-card-border shadow-sm">
                <div className="text-sm text-text-muted mb-1">Monthly Spending</div>
                <div className="text-2xl font-bold text-red-500">$3,240.50</div>
                <div className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <ArrowDownRight size={12} /> +5% from last month
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-card-border shadow-sm">
                <div className="text-sm text-text-muted mb-1">Savings Goal</div>
                <div className="text-2xl font-bold text-primary">85%</div>
                <div className="w-full bg-gray-100 h-2 rounded-full mt-2 overflow-hidden">
                  <div className="bg-primary h-full w-[85%]" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-card-border shadow-sm">
                <h4 className="font-bold mb-4 flex items-center justify-between">
                  Recent Transactions
                  <span className="text-xs text-primary cursor-pointer">View All</span>
                </h4>
                <div className="space-y-4">
                  {[
                    { icon: ShoppingBag, label: 'Grocery Store', date: 'Today, 2:45 PM', amount: '-$84.20', color: 'bg-orange-100 text-orange-600' },
                    { icon: CreditCard, label: 'Subscription', date: 'Yesterday', amount: '-$14.99', color: 'bg-blue-100 text-blue-600' },
                    { icon: Coffee, label: 'Starbucks', date: 'Oct 24', amount: '-$5.50', color: 'bg-green-100 text-green-600' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center`}>
                          <item.icon size={20} />
                        </div>
                        <div>
                          <div className="text-sm font-bold">{item.label}</div>
                          <div className="text-xs text-text-muted">{item.date}</div>
                        </div>
                      </div>
                      <div className="text-sm font-bold">{item.amount}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-card-border shadow-sm flex flex-col items-center justify-center min-h-[200px]">
                <div className="relative w-32 h-32 mb-4">
                  <svg className="w-full h-full" viewBox="0 0 36 36">
                    <path className="text-gray-100" strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    <path className="text-primary" strokeDasharray="70, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold">70%</span>
                    <span className="text-[10px] text-text-muted">Budget Used</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Monthly Budget Status</p>
                  <p className="text-xs text-text-muted mt-1">You have $1,200 left for this month</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-white/50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16">Loved by thousands</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Sarah J.', role: 'Freelancer', quote: 'FinanceAI changed how I view my business expenses. The AI categorization is a lifesaver!' },
              { name: 'Mark T.', role: 'Software Engineer', quote: 'The cleanest finance app I have ever used. The insights are actually helpful, not just numbers.' },
              { name: 'Elena R.', role: 'Student', quote: 'Finally a budget tool that does not feel like a chore. I have saved 20% more this month!' },
            ].map((t, i) => (
              <div key={i} className="card">
                <p className="italic text-text-muted mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{t.name}</div>
                    <div className="text-xs text-text-muted">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 bg-[#f5fbfe]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Simple Pricing</h2>
            <p className="text-text-muted">Choose the plan that fits your needs</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div className="card flex flex-col">
              <h3 className="text-xl font-bold mb-2">Free</h3>
              <div className="text-4xl font-bold mb-6">$0<span className="text-lg text-text-muted font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1">
                {['Unlimited Expenses', 'Basic Analytics', 'Manual Categorization', '1 Active Budget'].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={16} className="text-primary" /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => openAuth('register')} className="w-full py-2 border border-primary text-primary rounded-lg font-medium hover:bg-primary/5 transition-colors">
                Get Started
              </button>
            </div>
            <div className="card border-primary ring-1 ring-primary flex flex-col relative">
              <div className="absolute top-0 right-6 translate-y-[-50%] bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">POPULAR</div>
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <div className="text-4xl font-bold mb-6">$9<span className="text-lg text-text-muted font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1">
                {['Everything in Free', 'AI Auto-Categorization', 'Advanced Insights', 'Unlimited Budgets', 'PDF/Excel Exports'].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={16} className="text-primary" /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => openAuth('register')} className="btn-primary w-full">
                Go Pro
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-12 bg-white border-t border-card-border">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2 text-primary font-bold text-xl mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                <Wallet size={20} />
              </div>
              FinanceAI
            </div>
            <p className="text-text-muted text-sm max-w-xs">
              Empowering you to make smarter financial decisions with the power of AI.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><Link to="#" className="hover:text-primary">Features</Link></li>
              <li><Link to="#" className="hover:text-primary">Pricing</Link></li>
              <li><Link to="#" className="hover:text-primary">Security</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><Link to="#" className="hover:text-primary">About</Link></li>
              <li><Link to="#" className="hover:text-primary">Privacy</Link></li>
              <li><Link to="#" className="hover:text-primary">Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-card-border text-center text-sm text-text-muted">
          © 2026 FinanceAI. All rights reserved.
        </div>
      </footer>

      <Modal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} title={authMode === 'login' ? "Welcome Back" : "Create Account"}>
        <AuthForm onSuccess={() => setIsAuthModalOpen(false)} initialMode={authMode} />
      </Modal>
    </div>
  );
};

export default HomePage;
