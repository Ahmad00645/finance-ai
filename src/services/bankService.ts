import { collection, query, where, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, orderBy, limit, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface LinkedAccount {
  id: string;
  provider: string;
  institution_name: string;
  last_synced: string;
}

export interface BankTransaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  is_imported: boolean;
}

export const bankService = {
  getLinkedAccounts: async () => {
    const user = auth.currentUser;
    if (!user) return [];
    try {
      const q = query(collection(db, 'bank_accounts'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LinkedAccount[];
    } catch (error) {
      console.error('Error fetching linked accounts:', error);
      return [];
    }
  },

  syncTransactions: async (accountId: string) => {
    // Demo implementation
    return { success: true };
  },

  getUnimportedTransactions: async () => {
    const user = auth.currentUser;
    if (!user) return [];
    try {
      const q = query(
        collection(db, 'bank_transactions'), 
        where('userId', '==', user.uid),
        where('is_imported', '==', false)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BankTransaction[];
    } catch (error) {
      console.error('Error fetching unimported transactions:', error);
      return [];
    }
  },

  importTransaction: async (transactionId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const txRef = doc(db, 'bank_transactions', transactionId);
      const txSnap = await getDoc(txRef);
      
      if (!txSnap.exists()) throw new Error('Transaction not found');
      const txData = txSnap.data();

      const batch = writeBatch(db);
      
      // Mark as imported
      batch.update(txRef, { is_imported: true });
      
      // Add to expenses
      batch.set(doc(collection(db, 'expenses')), {
        userId: user.uid,
        description: txData.description,
        amount: txData.amount,
        category: txData.category,
        date: txData.date,
        createdAt: new Date().toISOString()
      });

      await batch.commit();
    } catch (error) {
      console.error('Error importing transaction:', error);
      throw error;
    }
  },

  unlinkAccount: async (accountId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const batch = writeBatch(db);
      
      // Delete the account document
      batch.delete(doc(db, 'bank_accounts', accountId));
      
      // Find all unimported transactions for this account and delete them too
      const q = query(
        collection(db, 'bank_transactions'), 
        where('userId', '==', user.uid),
        where('accountId', '==', accountId),
        where('is_imported', '==', false)
      );
      const snapshot = await getDocs(q);
      snapshot.docs.forEach((d) => {
        batch.delete(d.ref);
      });

      await batch.commit();
    } catch (error) {
      console.error('Error unlinking account:', error);
      throw error;
    }
  }
};
