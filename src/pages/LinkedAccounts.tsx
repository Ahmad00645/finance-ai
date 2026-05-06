import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link2, Unlink, RefreshCw, Plus, Building2, CheckCircle2, AlertCircle, ShoppingBag, CreditCard, Coffee, Landmark, Loader2 } from 'lucide-react';
import { bankService, LinkedAccount, BankTransaction } from '../services/bankService';
import toast from 'react-hot-toast';
import { useCurrency } from '../contexts/CurrencyContext';
import { useAuth } from '../AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import Modal from '../components/Modal';

const LinkedAccounts = () => {
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [unimported, setUnimported] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [accountToUnlink, setAccountToUnlink] = useState<LinkedAccount | null>(null);
  const [isUnlinkModalOpen, setIsUnlinkModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      const [accRes, txRes] = await Promise.all([
        bankService.getLinkedAccounts(),
        bankService.getUnimportedTransactions()
      ]);
      setAccounts(accRes);
      setUnimported(txRes);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMockLink = async () => {
    if (!user) return;
    try {
      // Create a mock account in Firestore
      const accountRef = await addDoc(collection(db, 'bank_accounts'), {
        userId: user.id,
        institution_name: 'Chase Bank',
        provider: 'PLAID',
        last_synced: new Date().toISOString()
      });

      // Create some mock transactions
      const mockTxs = [
        { description: 'Starbucks', amount: 5.50, category: 'Food', date: new Date().toISOString().split('T')[0] },
        { description: 'Amazon', amount: 45.00, category: 'Shopping', date: new Date().toISOString().split('T')[0] },
        { description: 'Uber', amount: 12.00, category: 'Transport', date: new Date().toISOString().split('T')[0] }
      ];

      for (const tx of mockTxs) {
        await addDoc(collection(db, 'bank_transactions'), {
          ...tx,
          userId: user.id,
          accountId: accountRef.id,
          is_imported: false
        });
      }

      toast.success('Bank account linked successfully (Demo Mode)');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to link account');
    }
  };

  const handleImport = async (txId: string) => {
    try {
      await bankService.importTransaction(txId);
      toast.success('Transaction imported to expenses');
      setUnimported(prev => prev.filter(tx => tx.id !== txId));
    } catch (err) {
      toast.error('Failed to import transaction');
    }
  };

  const handleUnlink = (account: LinkedAccount) => {
    setAccountToUnlink(account);
    setIsUnlinkModalOpen(true);
  };

  const confirmUnlink = async () => {
    if (!accountToUnlink) return;
    setIsUnlinking(true);
    try {
      await bankService.unlinkAccount(accountToUnlink.id);
      toast.success('Account unlinked successfully');
      setIsUnlinkModalOpen(false);
      setAccountToUnlink(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to unlink account');
    } finally {
      setIsUnlinking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-dark">Linked Accounts</h1>
          <p className="text-text-muted">Manage your connected bank accounts and cards</p>
        </div>
        <button
          onClick={handleMockLink}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Connect Bank
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {accounts.length > 0 ? (
          accounts.map((acc) => (
            <motion.div
              key={acc.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card border-primary/20 bg-primary/5"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-primary border border-primary/10">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{acc.institution_name}</h3>
                    <p className="text-xs text-text-muted uppercase tracking-wider font-bold">{acc.provider}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleUnlink(acc)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-text-muted hover:text-red-600 hover:bg-red-50 transition-all font-medium text-xs border border-transparent hover:border-red-100"
                  title="Unlink Account"
                >
                  <Unlink size={14} />
                  <span>Unlink</span>
                </button>
              </div>
              <div className="flex items-center justify-between text-sm mt-6 pt-4 border-t border-primary/10">
                <div className="text-text-muted">
                  Last synced: {new Date(acc.last_synced).toLocaleString()}
                </div>
                <div className="flex items-center gap-1 text-green-600 font-medium">
                  <CheckCircle2 size={14} /> Active
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="card col-span-full border-dashed border-2 flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-text-muted mb-4">
              <Landmark size={32} />
            </div>
            <h3 className="font-bold text-lg mb-2">No accounts linked yet</h3>
            <p className="text-text-muted max-w-sm mb-6">Connect your bank account to automatically import and categorize expenses.</p>
            <button onClick={handleMockLink} className="btn-secondary">Link your first account</button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          New Transactions
          {unimported.length > 0 && (
            <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">
              {unimported.length} New
            </span>
          )}
        </h2>

        {unimported.length > 0 ? (
          <div className="grid gap-4">
            <AnimatePresence>
              {unimported.map((tx) => (
                <motion.div
                  key={tx.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="card flex items-center justify-between hover:border-primary/30 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-text-muted">
                      {tx.category === 'Food' ? <Coffee size={20} /> :
                       tx.category === 'Shopping' ? <ShoppingBag size={20} /> :
                       <CreditCard size={20} />}
                    </div>
                    <div>
                      <div className="font-bold">{tx.description}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-text-muted">{tx.date}</span>
                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-text-muted font-medium">
                          {tx.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="font-bold text-red-500">-{formatAmount(tx.amount)}</div>
                      <div className="text-[10px] text-text-muted uppercase font-bold tracking-tighter">Debit</div>
                    </div>
                    <button
                      onClick={() => handleImport(tx.id)}
                      className="opacity-0 group-hover:opacity-100 bg-primary/10 text-primary px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary hover:text-white transition-all flex items-center gap-2"
                    >
                      <Plus size={16} /> Import
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="card flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="font-bold">All caught up!</h3>
            <p className="text-text-muted">No new transactions to import at the moment.</p>
          </div>
        )}
      </div>

      <div className="mt-12 p-6 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-4">
        <div className="p-2 bg-white rounded-lg text-blue-500 shadow-sm">
          <AlertCircle size={20} />
        </div>
        <div>
          <h4 className="font-bold text-blue-900 mb-1">About Bank Linking</h4>
          <p className="text-sm text-blue-800/80 leading-relaxed">
            We use industry-standard encryption to protect your data. This demo uses a simulated Plaid connection to show how automated tracking works without requiring real credentials.
          </p>
        </div>
      </div>

      <Modal
        isOpen={isUnlinkModalOpen}
        onClose={() => !isUnlinking && setIsUnlinkModalOpen(false)}
        title="Unlink Account"
      >
        <div className="space-y-6">
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
            <AlertCircle className="text-amber-600 shrink-0" size={20} />
            <div>
              <p className="text-sm text-amber-900 font-medium leading-relaxed">
                Are you sure you want to unlink <strong>{accountToUnlink?.institution_name}</strong>?
              </p>
              <p className="text-xs text-amber-800/70 mt-1">
                Any pending transactions will be removed. Your existing imported expenses will remain untouched.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setIsUnlinkModalOpen(false)}
              disabled={isUnlinking}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={confirmUnlink}
              disabled={isUnlinking}
              className="btn-primary bg-red-500 hover:bg-red-600 border-red-500 flex-1 flex items-center justify-center gap-2"
            >
              {isUnlinking ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Unlinking...
                </>
              ) : (
                'Unlink Account'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LinkedAccounts;
