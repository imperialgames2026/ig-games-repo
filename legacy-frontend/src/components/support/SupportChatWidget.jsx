import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Minimize2, Bot, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SupportChatWidget({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [chatId, setChatId] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  // Find or create chat
  const { data: chats = [] } = useQuery({
    queryKey: ['support-chats', user?.email],
    queryFn: () => base44.entities.SupportChat.filter({ 
      user_email: user?.email,
      status: { $in: ['open', 'in_progress'] }
    }),
    enabled: !!user?.email && isOpen,
    refetchInterval: 3000,
  });

  const activeChat = chats[0];

  useEffect(() => {
    if (activeChat) {
      setChatId(activeChat.id);
    }
  }, [activeChat?.id]);

  // Real-time subscription
  useEffect(() => {
    if (!chatId) return;

    const unsubscribe = base44.entities.SupportChat.subscribe((event) => {
      if (event.id === chatId && event.type === 'update') {
        queryClient.invalidateQueries(['support-chats']);
      }
    });

    return unsubscribe;
  }, [chatId]);

  const createChatMutation = useMutation({
    mutationFn: (data) => base44.entities.SupportChat.create(data),
    onSuccess: (newChat) => {
      setChatId(newChat.id);
      queryClient.invalidateQueries(['support-chats']);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: ({ id, messages }) => base44.entities.SupportChat.update(id, { 
      messages,
      last_message_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['support-chats']);
    },
  });

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const messageText = message.trim();
    const newMessage = {
      sender_email: user.email,
      sender_name: user.full_name || user.email,
      message: messageText,
      timestamp: new Date().toISOString(),
      is_admin: false,
    };

    let currentChatId = chatId;

    if (!chatId) {
      const newChat = await createChatMutation.mutateAsync({
        user_email: user.email,
        user_name: user.full_name || user.email,
        status: 'open',
        messages: [newMessage],
        last_message_at: new Date().toISOString(),
      });
      currentChatId = newChat.id;
      setChatId(newChat.id);
    } else {
      const updatedMessages = [...(activeChat?.messages || []), newMessage];
      await sendMessageMutation.mutateAsync({ id: chatId, messages: updatedMessages });
    }

    setMessage('');
    setAiLoading(true);

    try {
      await base44.functions.invoke('supportAIAssistant', {
        chatId: currentChatId,
        message: messageText,
      });
      queryClient.invalidateQueries(['support-chats']);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages]);

  if (!user) return null;

  return (
    <>
      {/* Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-20 md:right-6 z-50 w-16 h-16 bg-gradient-to-r from-pink-500 to-pink-600 rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
          >
            <MessageCircle className="w-8 h-8 text-white" />
            {chats.length > 0 && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {chats.reduce((sum, chat) => sum + (chat.messages?.length || 0), 0)}
              </div>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-4 md:right-6 z-50 w-96 max-w-[calc(100vw-2rem)] bg-[#1A1528] rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-pink-500 to-pink-600 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-white" />
                <div>
                  <h3 className="font-bold text-white">Live Support</h3>
                  <p className="text-xs text-pink-100 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {activeChat?.status === 'in_progress' ? 'AI + admin support active' : 'AI helper answers first, admin joins when needed'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="text-white hover:bg-white/20 rounded p-1"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-white/20 rounded p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="h-96 overflow-y-auto p-4 space-y-3">
                  {!activeChat && (
                    <div className="text-center text-gray-400 py-12">
                      <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Start a conversation with our support team</p>
                    </div>
                  )}

                  {activeChat?.messages?.map((msg, i) => {
                    const isAI = msg.sender_email === 'ai-support@imperialgaming.games';
                    return (
                      <div
                        key={i}
                        className={`flex ${msg.is_admin ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                            msg.is_admin
                              ? isAI
                                ? 'bg-cyan-500/10 border border-cyan-400/20 text-white'
                                : 'bg-white/10 text-white'
                              : 'bg-gradient-to-r from-pink-500 to-pink-600 text-white'
                          }`}
                        >
                          <p className="text-sm font-medium mb-1 flex items-center gap-1">
                            {isAI && <Bot className="w-3.5 h-3.5 text-cyan-300" />}
                            {msg.sender_name}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  {aiLoading && (
                    <div className="flex justify-start">
                      <div className="max-w-[75%] rounded-2xl px-4 py-2 bg-cyan-500/10 border border-cyan-400/20 text-white">
                        <p className="text-sm font-medium mb-1 flex items-center gap-1">
                          <Bot className="w-3.5 h-3.5 text-cyan-300" />
                          Imperialist AI
                        </p>
                        <p className="text-sm text-cyan-100">Thinking...</p>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10">
                  <div className="flex gap-2">
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 bg-white/10 border-white/20 text-white placeholder-gray-400"
                    />
                    <Button
                      type="submit"
                      disabled={!message.trim()}
                      className="bg-gradient-to-r from-pink-500 to-pink-600"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}