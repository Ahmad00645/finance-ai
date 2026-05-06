import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, MessageSquare, Loader2, Sparkles, User, Bot, X, Maximize2, Minimize2 } from 'lucide-react';
import { getChatResponse } from '../services/aiService';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface FinanceChatboardProps {
  context?: any;
}

const FinanceChatboard: React.FC<FinanceChatboardProps> = ({ context }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: 'Hi! I am your AI Assistant. How can I help you with your finances today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Prepare history for API
      const history = messages.slice(1).map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const response = await getChatResponse(userMessage, history, context);
      setMessages(prev => [...prev, { role: 'model', content: response }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      layout
      className={`card flex flex-col bg-white border border-card-border overflow-hidden transition-all duration-300 ${
        isExpanded ? 'fixed inset-4 md:inset-10 z-50 shadow-2xl' : 'h-[450px] relative shadow-sm'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-card-border bg-primary/5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <MessageSquare size={18} />}
          </div>
          <div>
            <h3 className="font-bold text-text-dark text-sm">AI Assistant</h3>
            <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Your Financial Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg hover:bg-white text-text-muted transition-colors"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          {isExpanded && (
            <button 
              onClick={() => setIsExpanded(false)}
              className="p-2 rounded-lg hover:bg-white text-text-muted transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                m.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 text-text-muted border border-card-border'
              }`}>
                {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                m.role === 'user' 
                  ? 'bg-primary text-white rounded-tr-none' 
                  : 'bg-gray-50 text-text-dark border border-gray-100 rounded-tl-none'
              }`}>
                {m.content}
              </div>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="flex gap-3 items-center">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-text-muted border border-card-border">
                <Bot size={14} />
              </div>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-card-border bg-white">
        <form 
          onSubmit={handleSend}
          className="relative"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Ask anything about your finances..."
            className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-card-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm shadow-inner"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
              input.trim() && !isLoading 
                ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95' 
                : 'text-text-muted bg-gray-200 cursor-not-allowed'
            }`}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-text-muted font-bold uppercase tracking-widest pl-1">
          <Sparkles size={10} className="text-primary" />
          AI Powered advice
        </div>
      </div>
    </motion.div>
  );
};

export default FinanceChatboard;
