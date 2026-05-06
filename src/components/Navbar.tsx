import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Receipt, Target, PieChart, Sparkles, LogOut, Wallet, Landmark, Menu, X, ChevronLeft } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Expenses', path: '/expenses', icon: Receipt },
    { name: 'Budgets', path: '/budgets', icon: Target },
    { name: 'Analytics', path: '/analytics', icon: PieChart },
    { name: 'AI Insights', path: '/insights', icon: Sparkles },
    { name: 'Accounts', path: '/accounts', icon: Landmark },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="bg-white border-b border-card-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-1 sm:gap-4">
            {/* Mobile Back Button */}
            {user && location.pathname !== '/dashboard' && (
              <button 
                onClick={() => navigate(-1)}
                className="lg:hidden p-2 -ml-2 text-text-muted hover:text-primary transition-colors"
                aria-label="Go back"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2 text-primary font-bold text-xl shrink-0">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                <Wallet size={20} />
              </div>
              <span className="inline">FinanceAI</span>
            </Link>
            {user && (
              <div className="hidden lg:ml-8 lg:flex lg:space-x-4">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.path;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        isActive 
                          ? "bg-primary/10 text-primary" 
                          : "text-text-muted hover:text-text-dark hover:bg-gray-50"
                      )}
                    >
                      <Icon size={18} />
                      {link.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <>
                <div className="hidden sm:flex flex-col items-end mr-2">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Active Secure</span>
                  <span className="text-[10px] text-text-muted truncate max-w-[120px]">{user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="hidden md:flex items-center gap-2 text-text-muted hover:text-red-500 transition-colors text-sm font-medium border border-gray-100 px-3 py-1.5 rounded-lg hover:border-red-100"
                >
                  <LogOut size={16} />
                  Logout
                </button>
                
                {/* Mobile Menu Toggle */}
                <button 
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="lg:hidden p-2 text-text-muted hover:text-primary transition-colors hover:bg-gray-50 rounded-lg"
                >
                  {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3 sm:gap-4">
                <Link to="/" className="hidden sm:block text-sm font-medium text-text-muted hover:text-text-dark transition-colors mr-2">
                  Features
                </Link>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => navigate('/?auth=login')}
                    className="text-sm font-medium text-text-muted hover:text-primary px-3 py-1.5 transition-colors"
                  >
                    Login
                  </button>
                  <button 
                    onClick={() => navigate('/?auth=register')}
                    className="btn-primary py-1.5 px-5 text-sm rounded-full shadow-lg shadow-primary/10"
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && user && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[51] lg:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[280px] bg-white shadow-2xl z-[100] lg:hidden flex flex-col pt-20"
            >
              <div className="flex flex-col p-4 gap-2">
                <div className="mb-6 px-4">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Logged in as</p>
                  <p className="text-sm font-bold text-text-dark truncate">{user.email}</p>
                </div>
                
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.path;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                        isActive 
                          ? "bg-primary text-white shadow-lg shadow-primary/20" 
                          : "text-text-muted hover:text-text-dark hover:bg-gray-50"
                      )}
                    >
                      <Icon size={20} />
                      {link.name}
                    </Link>
                  );
                })}
              </div>

              <div className="mt-auto p-4 border-t border-gray-100">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-4 rounded-xl text-red-500 font-bold hover:bg-red-50 transition-colors"
                >
                  <LogOut size={20} />
                  Logout Account
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
