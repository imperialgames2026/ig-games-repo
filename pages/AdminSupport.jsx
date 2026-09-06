import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MessageCircle, Send, CheckCircle, Clock, User, X, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminSupport() {
  const [user, setUser] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        if (u.role !== 'admin') {
          window.location.href = '/';
          return;
        }
        setUser(u);
      } catch (e) {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
  }, []);

  const { data: allChats = [] } = useQuery({
    queryKey: ['admin-support-chats'],
    queryFn: () => base44.entities.SupportChat.list('-last_message_at', 100),
    enabled: !!user,
    refetchInterval: 2000,
  });

  const openChats = allChats.filter(c => c.status === 'open');
  const inProgressChats = allChats.filter(c => c.status === 'in_progress');
  const closedChats = allChats.filter(c => c.status === 'closed');

  // Real-time subscriptions
  useEffect(() => {
    if (!user) return;

    const unsubscribe = base44.entities.SupportChat.subscribe((event) => {
      queryClient.invalidateQueries(['admin-support-chats']);
    });

    return unsubscribe;
  }, [user]);

  const updateChatMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SupportChat.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-support-chats']);
    },
  });

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedChat) return;

    const newMessage = {
      sender_email: user.email,
      sender_name: user.full_name || 'Admin',
      message: message.trim(),
      timestamp: new Date().toISOString(),
      is_admin: true,
    };

    const updatedMessages = [...(selectedChat.messages || []), newMessage];

    await updateChatMutation.mutateAsync({
      id: selectedChat.id,
      data: {
        messages: updatedMessages,
        last_message_at: new Date().toISOString(),
        status: 'in_progress',
        admin_email: user.email,
      },
    });

    setMessage('');
  };

  const handleClaimChat = (chat) => {
    updateChatMutation.mutate({
      id: chat.id,
      data: {
        status: 'in_progress',
        admin_email: user.email,
      },
    });
    setSelectedChat(chat);
  };

  const handleCloseChat = (chat) => {
    updateChatMutation.mutate({
      id: chat.id,
      data: { status: 'closed' },
    });
    if (selectedChat?.id === chat.id) {
      setSelectedChat(null);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChat?.messages]);

  // Auto-update selected chat
  useEffect(() => {
    if (selectedChat) {
      const updated = allChats.find(c => c.id === selectedChat.id);
      if (updated) {
        setSelectedChat(updated);
      }
    }
  }, [allChats]);

  if (!user) return null;

  const ChatList = ({ chats, status }) => (
    <div className="space-y-2">
      {chats.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No {status} chats</p>
        </div>
      ) : (
        chats.map((chat) => (
          <motion.div
            key={chat.id}
            whileHover={{ scale: 1.02 }}
            onClick={() => setSelectedChat(chat)}
            className={`p-4 rounded-lg cursor-pointer transition-colors ${
              selectedChat?.id === chat.id
                ? 'bg-pink-500/20 border-2 border-pink-500'
                : 'bg-white/5 hover:bg-white/10 border-2 border-transparent'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="font-bold text-white">{chat.user_name}</span>
              </div>
              {status === 'open' && (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClaimChat(chat);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Claim
                </Button>
              )}
              {status !== 'closed' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseChat(chat);
                  }}
                  className="text-red-400 hover:bg-red-500/20"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-sm text-gray-400 line-clamp-2">
              {chat.messages?.[chat.messages.length - 1]?.message || 'No messages yet'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {chat.messages?.some((msg) => msg.sender_email === 'ai-support@imperialgaming.games') && (
                <div className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 px-2 py-1 text-[11px] text-cyan-200">
                  <Bot className="w-3 h-3" />
                  AI assisted
                </div>
              )}
              {chat.ai_needs_human_review && (
                <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-400/20 px-2 py-1 text-[11px] text-amber-200">
                  Human review
                </div>
              )}
              {chat.ai_action_type === 'kyc_help' && (
                <div className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 border border-pink-400/20 px-2 py-1 text-[11px] text-pink-200">
                  KYC help
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {new Date(chat.last_message_at || chat.created_date).toLocaleString()}
            </p>
          </motion.div>
        ))
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0612] p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-black text-white mb-8">Live Support Dashboard</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat List */}
          <div className="lg:col-span-1">
            <Tabs defaultValue="open" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-[#1A1528]">
                <TabsTrigger value="open" className="data-[state=active]:bg-pink-500">
                  <Clock className="w-4 h-4 mr-2" />
                  Open ({openChats.length})
                </TabsTrigger>
                <TabsTrigger value="active" className="data-[state=active]:bg-pink-500">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Active ({inProgressChats.length})
                </TabsTrigger>
                <TabsTrigger value="closed" className="data-[state=active]:bg-pink-500">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Closed ({closedChats.length})
                </TabsTrigger>
              </TabsList>

              <div className="mt-4 max-h-[calc(100vh-16rem)] overflow-y-auto">
                <TabsContent value="open">
                  <ChatList chats={openChats} status="open" />
                </TabsContent>
                <TabsContent value="active">
                  <ChatList chats={inProgressChats} status="active" />
                </TabsContent>
                <TabsContent value="closed">
                  <ChatList chats={closedChats} status="closed" />
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Chat Window */}
          <div className="lg:col-span-2">
            {selectedChat ? (
              <div className="bg-[#1A1528] rounded-2xl border border-white/10 h-[calc(100vh-12rem)] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white">{selectedChat.user_name}</h2>
                      <p className="text-sm text-gray-400">{selectedChat.user_email}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedChat.messages?.some((msg) => msg.sender_email === 'ai-support@imperialgaming.games') && (
                          <div className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 px-2 py-1 text-[11px] text-cyan-200">
                            <Bot className="w-3 h-3" />
                            AI handled part of this chat
                          </div>
                        )}
                        {selectedChat.ai_needs_human_review && (
                          <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-400/20 px-2 py-1 text-[11px] text-amber-200">
                            Human review requested
                          </div>
                        )}
                        {selectedChat.ai_action_type === 'kyc_help' && (
                          <div className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 border border-pink-400/20 px-2 py-1 text-[11px] text-pink-200">
                            KYC help requested
                          </div>
                        )}
                      </div>
                      {selectedChat.ai_support_note && (
                        <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200 mb-1">AI internal note</p>
                          <p className="text-sm text-amber-50 whitespace-pre-wrap">{selectedChat.ai_support_note}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleCloseChat(selectedChat)}
                        variant="outline"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/20"
                      >
                        Close Chat
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {selectedChat.messages?.map((msg, i) => {
                    const isAI = msg.sender_email === 'ai-support@imperialgaming.games';
                    return (
                      <div
                        key={i}
                        className={`flex ${msg.is_admin ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                            msg.is_admin
                              ? isAI
                                ? 'bg-cyan-500/10 border border-cyan-400/20 text-white'
                                : 'bg-gradient-to-r from-pink-500 to-pink-600 text-white'
                              : 'bg-white/10 text-white'
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
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSendMessage} className="p-6 border-t border-white/10">
                  <div className="flex gap-3">
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your response..."
                      className="flex-1 bg-white/10 border-white/20 text-white placeholder-gray-400"
                    />
                    <Button
                      type="submit"
                      disabled={!message.trim()}
                      className="bg-gradient-to-r from-pink-500 to-pink-600"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-[#1A1528] rounded-2xl border border-white/10 h-[calc(100vh-12rem)] flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-xl">Select a chat to start responding</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}