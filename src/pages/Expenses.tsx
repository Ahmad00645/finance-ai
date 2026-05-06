import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Edit2, Search, ChevronDown, Check, Globe, Filter, Calendar, X, ChevronLeft, ChevronRight, Camera, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isValid } from 'date-fns';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../AuthContext';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { useCurrency } from '../contexts/CurrencyContext';
import { categorizeExpense, scanReceipt } from '../services/aiService';

const Expenses = () => {
  const { user } = useAuth();
  const { formatAmount, currency: currentCurrency, setCurrency, SUPPORTED_CURRENCIES } = useCurrency();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Auto (AI)',
    date: format(new Date(), 'yyyy-MM-dd'),
    currencyCode: currentCurrency.code
  });
  const [isAiCategorizing, setIsAiCategorizing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasManuallySelectedCategory, setHasManuallySelectedCategory] = useState(false);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [isGlobalCurrencyDropdownOpen, setIsGlobalCurrencyDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkCategoryModalOpen, setIsBulkCategoryModalOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('Food');
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  const currencyDropdownRef = useRef<HTMLDivElement>(null);
  const globalCurrencyDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const startDatePickerRef = useRef<HTMLDivElement>(null);
  const endDatePickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ['Food', 'Transport', 'Shopping', 'Rent', 'Bills', 'Entertainment', 'Health', 'Education', 'Other'];

  const suggestCategory = async (description: string) => {
    if (!description || description.length < 3 || hasManuallySelectedCategory || editingId) return;
    
    setIsAiCategorizing(true);
    try {
      const suggestedCategory = await categorizeExpense(description);
      setFormData(prev => ({ ...prev, category: suggestedCategory }));
      toast.success(`AI suggested: ${suggestedCategory}`, { 
        icon: '🤖',
        duration: 2000,
        id: 'ai-suggestion'
      });
    } catch (err) {
      console.error('AI categorization failed', err);
    } finally {
      setIsAiCategorizing(false);
    }
  };

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDesc = e.target.value;
    setFormData({ ...formData, description: newDesc });
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      suggestCategory(newDesc);
    }, 1000);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(event.target as Node)) {
        setIsCurrencyDropdownOpen(false);
      }
      if (globalCurrencyDropdownRef.current && !globalCurrencyDropdownRef.current.contains(event.target as Node)) {
        setIsGlobalCurrencyDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
      if (startDatePickerRef.current && !startDatePickerRef.current.contains(event.target as Node)) {
        setIsStartDatePickerOpen(false);
      }
      if (endDatePickerRef.current && !endDatePickerRef.current.contains(event.target as Node)) {
        setIsEndDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setIsScanning(true);
    const toastId = toast.loading('AI is scanning your receipt...', { icon: '🤖' });

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const result = await scanReceipt(base64Data, file.type);

        if (result) {
          setFormData({
            description: result.vendor || '',
            amount: result.amount?.toString() || '',
            category: result.category || 'Other',
            date: result.date || format(new Date(), 'yyyy-MM-dd'),
            currencyCode: currentCurrency.code
          });
          setHasManuallySelectedCategory(true);
          setIsModalOpen(true);
          toast.success('Receipt scanned successfully!', { id: toastId });
        } else {
          toast.error('Could not extract data from receipt', { id: toastId });
        }
        setIsScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Receipt scanning failed', err);
      toast.error('Failed to scan receipt', { id: toastId });
      setIsScanning(false);
    }
    
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fetchExpenses = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'expenses'), 
        where('userId', '==', user.id),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setExpenses(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Convert amount to USD for storage
    const selectedCurrency = SUPPORTED_CURRENCIES.find(c => c.code === formData.currencyCode) || SUPPORTED_CURRENCIES[0];
    const amountInUsd = parseFloat(formData.amount) / selectedCurrency.rate;

    try {
      if (editingId) {
        const expenseRef = doc(db, 'expenses', editingId);
        await updateDoc(expenseRef, {
          description: formData.description,
          amount: amountInUsd,
          category: formData.category,
          date: formData.date,
          updatedAt: new Date().toISOString()
        });
        toast.success('Expense updated!');
      } else {
        await addDoc(collection(db, 'expenses'), {
          userId: user.id,
          description: formData.description,
          amount: amountInUsd,
          category: formData.category,
          date: formData.date,
          createdAt: new Date().toISOString()
        });
        toast.success('Expense added!');
      }
      handleCloseModal();
      fetchExpenses();
    } catch (err) {
      console.error(err);
      toast.error(editingId ? 'Failed to update expense' : 'Failed to add expense');
    }
  };

  const handleEdit = (expense: any) => {
    setEditingId(expense.id);
    setHasManuallySelectedCategory(true); // Don't auto-suggest on edit
    setFormData({
      description: expense.description,
      amount: (expense.amount * currentCurrency.rate).toFixed(2),
      category: expense.category,
      date: expense.date,
      currencyCode: currentCurrency.code
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setHasManuallySelectedCategory(false);
    setFormData({
      description: '',
      amount: '',
      category: 'Other',
      date: format(new Date(), 'yyyy-MM-dd'),
      currencyCode: currentCurrency.code
    });
  };

  const renderCalendar = (selectedDate: string, onSelect: (date: string) => void) => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const selected = selectedDate ? parseISO(selectedDate) : null;

    return (
      <div className="p-4 w-64 bg-white rounded-2xl border border-card-border shadow-2xl z-[60]">
        <div className="flex items-center justify-between mb-4">
          <button onClick={(e) => { e.stopPropagation(); setCurrentMonth(subMonths(currentMonth, 1)); }} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-bold uppercase tracking-wider">{format(currentMonth, 'MMMM yyyy')}</span>
          <button onClick={(e) => { e.stopPropagation(); setCurrentMonth(addMonths(currentMonth, 1)); }} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <span key={`${d}-${i}`} className="text-[10px] font-bold text-text-muted text-center">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const isSelected = selected && isSameDay(day, selected);
            const isCurrentMonth = isSameMonth(day, monthStart);
            return (
              <button
                key={format(day, 'yyyy-MM-dd')}
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelect(format(day, 'yyyy-MM-dd')); }}
                className={`h-8 w-8 text-xs rounded-lg flex items-center justify-center transition-all ${
                  isSelected ? 'bg-primary text-white font-bold shadow-lg shadow-primary/20' : 
                  isCurrentMonth ? 'hover:bg-primary/10 text-text-dark' : 'text-text-muted opacity-30'
                }`}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const handleDeleteClick = (id: number) => {
    setDeletingId(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteDoc(doc(db, 'expenses', deletingId));
      toast.success('Expense deleted');
      fetchExpenses();
      setIsDeleteModalOpen(false);
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredExpenses.map(exp => exp.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'expenses', id));
      });
      await batch.commit();
      
      toast.success(`${selectedIds.length} expenses deleted`);
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      fetchExpenses();
    } catch (err) {
      toast.error('Failed to delete expenses');
    }
  };

  const handleBulkCategoryUpdate = async () => {
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, 'expenses', id), { category: bulkCategory });
      });
      await batch.commit();

      toast.success(`Category updated for ${selectedIds.length} expenses`);
      setSelectedIds([]);
      setIsBulkCategoryModalOpen(false);
      fetchExpenses();
    } catch (err) {
      toast.error('Failed to update category');
    }
  };

  const filteredExpenses = expenses.filter(exp => {
    const matchesCategory = selectedCategory === 'All' || exp.category === selectedCategory;
    const matchesStartDate = !startDate || exp.date >= startDate;
    const matchesEndDate = !endDate || exp.date <= endDate;
    return matchesCategory && matchesStartDate && matchesEndDate;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-dark">Expenses</h1>
          <p className="text-sm text-text-muted">Manage your daily spending</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Category Filter */}
          <div className="relative flex-grow sm:flex-grow-0" ref={categoryDropdownRef}>
            <button
              onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
              className="w-full flex items-center justify-between sm:justify-start gap-3 bg-white px-3 sm:px-4 py-2 rounded-xl border border-card-border shadow-sm hover:border-primary/50 transition-all active:scale-95"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                  <Filter size={16} />
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider leading-none mb-1">Category</p>
                  <span className="text-sm font-bold truncate max-w-[80px] sm:max-w-none block">
                    {selectedCategory === 'All' ? 'All' : selectedCategory}
                  </span>
                </div>
              </div>
              <ChevronDown size={14} className={`text-text-muted transition-transform duration-300 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {/* Dropdown menu ... (rest of the code) */}

            <AnimatePresence>
              {isCategoryDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute left-0 mt-2 w-48 bg-white rounded-xl border border-card-border shadow-xl z-50 overflow-hidden"
                >
                  <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar">
                    <button
                      onClick={() => { setSelectedCategory('All'); setIsCategoryDropdownOpen(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedCategory === 'All' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-gray-50 text-text-dark'
                      }`}
                    >
                      <span>All Categories</span>
                      {selectedCategory === 'All' && <Check size={14} />}
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c}
                        onClick={() => { setSelectedCategory(c); setIsCategoryDropdownOpen(false); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedCategory === c ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-gray-50 text-text-dark'
                        }`}
                      >
                        <span>{c}</span>
                        {selectedCategory === c && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-card-border shadow-sm">
            <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
              <Calendar size={16} />
            </div>
            <div className="flex flex-col">
              <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider leading-none mb-1">Date Range</p>
              <div className="flex items-center gap-2">
                {/* Start Date */}
                <div className="relative" ref={startDatePickerRef}>
                  <button 
                    onClick={() => { setIsStartDatePickerOpen(!isStartDatePickerOpen); setIsEndDatePickerOpen(false); }}
                    className="text-xs font-bold hover:text-primary transition-colors"
                  >
                    {startDate || 'Start Date'}
                  </button>
                  <AnimatePresence>
                    {isStartDatePickerOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute left-0 mt-2 z-50"
                      >
                        {renderCalendar(startDate, (date) => { setStartDate(date); setIsStartDatePickerOpen(false); })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <span className="text-text-muted text-[10px] font-bold">TO</span>

                {/* End Date */}
                <div className="relative" ref={endDatePickerRef}>
                  <button 
                    onClick={() => { setIsEndDatePickerOpen(!isEndDatePickerOpen); setIsStartDatePickerOpen(false); }}
                    className="text-xs font-bold hover:text-primary transition-colors"
                  >
                    {endDate || 'End Date'}
                  </button>
                  <AnimatePresence>
                    {isEndDatePickerOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 z-50"
                      >
                        {renderCalendar(endDate, (date) => { setEndDate(date); setIsEndDatePickerOpen(false); })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {(startDate || endDate) && (
                  <button 
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="p-1 hover:bg-red-50 text-red-500 rounded-md transition-colors"
                    title="Clear Range"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Global Currency Dropdown */}
          <div className="relative" ref={globalCurrencyDropdownRef}>
            <button
              onClick={() => setIsGlobalCurrencyDropdownOpen(!isGlobalCurrencyDropdownOpen)}
              className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-card-border shadow-sm hover:border-primary/50 transition-all active:scale-95"
            >
              <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                <Globe size={18} />
              </div>
              <div className="text-left">
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider leading-none mb-1">Currency</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{currentCurrency.code} ({currentCurrency.symbol})</span>
                  <ChevronDown size={14} className={`text-text-muted transition-transform duration-300 ${isGlobalCurrencyDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </button>

            <AnimatePresence>
              {isGlobalCurrencyDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-card-border shadow-xl z-50 overflow-hidden"
                >
                  <div className="p-2">
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => {
                          setCurrency(c.code);
                          setIsGlobalCurrencyDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                          currentCurrency.code === c.code 
                            ? 'bg-primary/10 text-primary font-bold' 
                            : 'hover:bg-gray-50 text-text-dark'
                        }`}
                      >
                        <span>{c.code} ({c.symbol})</span>
                        {currentCurrency.code === c.code && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleReceiptUpload}
            accept="image/*"
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isScanning}
            className="btn-secondary flex items-center gap-2"
          >
            {isScanning ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
            {isScanning ? 'Scanning...' : 'Scan Receipt'}
          </button>
          <button onClick={() => { setEditingId(null); setIsModalOpen(true); }} className="btn-primary flex items-center gap-2">
            <Plus size={20} />
            Add Expense
          </button>
        </div>
      </div>

      <div className="card overflow-hidden relative">
        {/* Bulk Actions Toolbar */}
        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-text-dark text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/10"
            >
              <span className="text-sm font-bold border-r border-white/20 pr-4 mr-2">
                {selectedIds.length} selected
              </span>
              <button 
                onClick={() => setIsBulkCategoryModalOpen(true)}
                className="flex items-center gap-2 hover:text-primary transition-colors text-sm font-bold"
              >
                <Edit2 size={16} />
                Set Category
              </button>
              <button 
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="flex items-center gap-2 hover:text-red-400 transition-colors text-sm font-bold"
              >
                <Trash2 size={16} />
                Delete
              </button>
              <button 
                onClick={() => setSelectedIds([])}
                className="ml-2 p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {filteredExpenses.length > 0 ? (
          <div className="overflow-x-auto -mx-6 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-[800px] w-full text-left">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="px-6 py-4 w-10">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        checked={selectedIds.length === filteredExpenses.length && filteredExpenses.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-text-muted">Date</th>
                    <th className="px-6 py-4 text-sm font-semibold text-text-muted">Description</th>
                    <th className="px-6 py-4 text-sm font-semibold text-text-muted">Category</th>
                    <th className="px-6 py-4 text-sm font-semibold text-text-muted">Amount</th>
                    <th className="px-6 py-4 text-sm font-semibold text-text-muted text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {filteredExpenses.map((exp, index) => (
                    <tr 
                      key={exp.id} 
                      className={`transition-colors hover:bg-primary/5 ${
                        selectedIds.includes(exp.id) ? 'bg-primary/5' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                          checked={selectedIds.includes(exp.id)}
                          onChange={() => handleSelectRow(exp.id)}
                        />
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">{format(new Date(exp.date), 'MMM dd, yyyy')}</td>
                      <td className="px-6 py-4 text-sm font-medium">{exp.description}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-bold whitespace-nowrap">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold whitespace-nowrap">{formatAmount(exp.amount)}</td>
                      <td className="px-6 py-4 text-right flex justify-end gap-3">
                        <button onClick={() => handleEdit(exp)} className="text-text-muted hover:text-primary transition-colors">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDeleteClick(exp.id)} className="text-text-muted hover:text-red-500 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-text-muted">
              <Search size={32} />
            </div>
            <p className="text-text-muted">
              {expenses.length > 0 
                ? `No expenses found in "${selectedCategory}" category.`
                : "No expenses yet. Add your first expense!"}
            </p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingId ? "Edit Expense" : "Add Expense"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Description</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="Lunch at restaurant"
              value={formData.description}
              onChange={handleDescriptionChange}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="relative" ref={currencyDropdownRef}>
              <label className="block text-sm font-medium text-text-muted mb-1">Currency</label>
              <button
                type="button"
                onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                className="w-full flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-card-border shadow-sm hover:border-primary/50 transition-all active:scale-[0.98] text-left"
              >
                <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                  <Globe size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-text-dark">
                      {SUPPORTED_CURRENCIES.find(c => c.code === formData.currencyCode)?.code} ({SUPPORTED_CURRENCIES.find(c => c.code === formData.currencyCode)?.symbol})
                    </span>
                    <ChevronDown size={16} className={`text-text-muted transition-transform duration-300 ${isCurrencyDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {isCurrencyDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute left-0 right-0 mt-2 bg-white rounded-xl border border-card-border shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="p-2 max-h-60 overflow-y-auto custom-scrollbar">
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, currencyCode: c.code });
                            setIsCurrencyDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                            formData.currencyCode === c.code 
                              ? 'bg-primary/10 text-primary font-bold' 
                              : 'hover:bg-gray-50 text-text-dark hover:pl-4'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${formData.currencyCode === c.code ? 'bg-primary' : 'bg-transparent'}`} />
                            <span>{c.code} <span className="text-text-muted font-normal">({c.symbol})</span></span>
                          </div>
                          {formData.currencyCode === c.code && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                              <Check size={14} />
                            </motion.div>
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Amount</label>
              <div className="flex items-center w-full px-4 py-2.5 rounded-xl border border-card-border focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all bg-white shadow-sm">
                <span className="text-text-muted font-bold pr-2 shrink-0 border-r border-gray-100 mr-2">
                  {SUPPORTED_CURRENCIES.find(c => c.code === formData.currencyCode)?.symbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full focus:outline-none bg-transparent text-text-dark font-medium"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-text-muted">Category</label>
              {isAiCategorizing && (
                <span className="text-[10px] text-primary font-bold flex items-center gap-1 animate-pulse">
                  <span className="w-1 h-1 bg-primary rounded-full" />
                  AI Suggesting...
                </span>
              )}
            </div>
            <select
              className="input-field"
              value={formData.category}
              onChange={(e) => {
                setFormData({ ...formData, category: e.target.value });
                setHasManuallySelectedCategory(true);
              }}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Date</label>
            <input
              type="date"
              required
              className="input-field"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>
          <button type="submit" disabled={isAiCategorizing} className="btn-primary w-full mt-2">
            {isAiCategorizing ? 'Categorizing...' : (editingId ? 'Update Expense' : 'Add Expense')}
          </button>
        </form>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Delete">
        <div className="space-y-4">
          <p className="text-text-muted">Are you sure you want to delete this expense? This action cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setIsDeleteModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={confirmDelete} className="btn-primary bg-red-500 hover:bg-red-600 border-red-500 flex-1">Delete</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="Confirm Bulk Delete">
        <div className="space-y-4">
          <p className="text-text-muted">Are you sure you want to delete {selectedIds.length} expenses? This action cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setIsBulkDeleteModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleBulkDelete} className="btn-primary bg-red-500 hover:bg-red-600 border-red-500 flex-1">Delete All</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isBulkCategoryModalOpen} onClose={() => setIsBulkCategoryModalOpen(false)} title="Bulk Set Category">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Assign a common category to {selectedIds.length} selected expenses.</p>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Category</label>
            <select
              className="input-field"
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setIsBulkCategoryModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleBulkCategoryUpdate} className="btn-primary flex-1">Update Category</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Expenses;
