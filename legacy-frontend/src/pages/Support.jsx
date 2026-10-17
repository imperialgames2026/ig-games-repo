import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, User, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function Support() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m Imperialist, your Imperial Casino support assistant. How can I help you today? I can assist with account issues, game rules, bonuses, payments, and more. If needed, I can connect you with a live support agent.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLiveSupport, setShowLiveSupport] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
      } catch (e) {
        // User not logged in
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const conversationHistory = messages.map(m => `${m.role === 'user' ? 'User' : 'Imperialist'}: ${m.content}`).join('\n');
      
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Imperialist, the friendly AI support assistant for Imperial Casino. You help users with:
- Account issues and settings
- Game rules and how to play
- Bonus information and promotions
- Payment and withdrawal questions
- Technical issues
- General casino questions

Be helpful, friendly, and concise. If the issue requires human intervention (payment disputes, account verification, serious technical issues), suggest they request live support.

User: ${user?.full_name || 'Guest'}
Email: ${user?.email || 'Not logged in'}

Conversation history:
${conversationHistory}

Current question: ${input}

Respond helpfully:`,
      });

      const aiMessage = {
        role: 'assistant',
        content: response.data,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);

      // Check if user should be escalated to live support
      if (response.data.toLowerCase().includes('live support') || response.data.toLowerCase().includes('human agent')) {
        setTimeout(() => {
          setShowLiveSupport(true);
        }, 1000);
      }
    } catch (error) {
      toast.error('Failed to get response. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const requestLiveSupport = () => {
    setShowLiveSupport(true);
    toast.success('Live support request submitted! Our team will reach out shortly.');
  };

  return (
    <div className="min-h-screen bg-[#0A0612] py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-32 h-32 mb-4">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697dc67abbb768c5bbbab5d5/7ccbd401d_1766563791186_Firefly_GeminiFlash_BigCitybackgroundskyscrapersurbangraffitiarttrafficmaincharacter-pink323161png3.jpg"
              alt="Imperialist"
              className="w-full h-full object-contain drop-shadow-2xl"
            />
          </div>
          <h1 className="text-4xl font-black text-white mb-2">Support Center</h1>
          <p className="text-gray-400">Chat with Imperialist, your AI support assistant</p>
        </div>

        <div className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-3xl overflow-hidden">
          {/* Messages */}
          <div className="h-[600px] overflow-y-auto p-6 space-y-4">
            <AnimatePresence>
              {messages.map((message, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-12 h-12 flex-shrink-0">
                      <img 
                        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697dc67abbb768c5bbbab5d5/7ccbd401d_1766563791186_Firefly_GeminiFlash_BigCitybackgroundskyscrapersurbangraffitiarttrafficmaincharacter-pink323161png3.jpg"
                        alt="Imperialist"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    message.role === 'user' 
                      ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white' 
                      : 'bg-white/5 text-white border border-white/10'
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    <span className="text-xs opacity-50 mt-1 block">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  {message.role === 'user' && (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div className="w-12 h-12">
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697dc67abbb768c5bbbab5d5/7ccbd401d_1766563791186_Firefly_GeminiFlash_BigCitybackgroundskyscrapersurbangraffitiarttrafficmaincharacter-pink323161png3.jpg"
                    alt="Imperialist"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                  <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Live Support Banner */}
          <AnimatePresence>
            {showLiveSupport && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-white/10 bg-green-500/10 px-6 py-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-bold mb-1">Need Human Support?</h3>
                    <p className="text-sm text-gray-400">Our live support team is here to help!</p>
                  </div>
                  <Button
                    onClick={requestLiveSupport}
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Contact Live Support
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="border-t border-white/10 p-6">
            <div className="flex gap-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type your question here..."
                className="flex-1 bg-white/5 border-white/10 text-white resize-none min-h-[60px]"
                disabled={loading}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 h-[60px] px-6"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <button
                onClick={requestLiveSupport}
                className="text-sm text-gray-400 hover:text-pink-400 transition-colors"
              >
                Skip to Live Support →
              </button>
            </div>
          </div>
        </div>

        {/* Quick Help Topics */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { title: 'Account Help', question: 'I need help with my account settings' },
            { title: 'Game Rules', question: 'How do I play the games?' },
            { title: 'Bonuses', question: 'Tell me about available bonuses' },
            { title: 'Payments', question: 'I have a question about payments' }
          ].map((topic, i) => (
            <button
              key={i}
              onClick={() => {
                setInput(topic.question);
                setTimeout(() => sendMessage(), 100);
              }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-pink-500/30 transition-all text-white text-sm font-medium"
            >
              {topic.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}