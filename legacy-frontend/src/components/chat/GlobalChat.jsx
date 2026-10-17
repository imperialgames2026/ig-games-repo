import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, MessageCircle, ChevronDown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CUSTOM_EMOJIS = [
  { label: '🚀', title: 'Rocket' },
  { label: '💣', title: 'Mines' },
  { label: '💰', title: 'Win' },
  { label: '🔥', title: 'Fire' },
  { label: '💎', title: 'Diamond' },
  { label: '👑', title: 'Crown' },
  { label: '😂', title: 'LOL' },
  { label: '😤', title: 'Rage' },
  { label: '♠️', title: 'Poker' },
  { label: '🃏', title: 'Cards' },
];

const ROOMS = [
  { id: 'global', label: '🌐 Global' },
  { id: 'poker-lobby', label: '♠️ Poker' },
  { id: 'blackjack-lobby', label: '🃏 Blackjack' },
];

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function ChatRoom({ roomId, user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    base44.entities.GlobalChat.filter({ room_id: roomId }, '-created_date', 60).then(msgs => {
      setMessages(msgs.reverse());
    });

    const unsub = base44.entities.GlobalChat.subscribe((event) => {
      if (event.type === 'create' && event.data?.room_id === roomId) {
        setMessages(prev => [...prev, event.data]);
      }
    });
    return unsub;
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !user || sending) return;
    setSending(true);
    setInput('');
    await base44.entities.GlobalChat.create({
      room_id: roomId,
      user_email: user.email,
      display_name: user.full_name || user.email.split('@')[0],
      message: text,
      profile_picture: user.profile_picture || null,
    });
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const insertEmoji = (emoji) => {
    setInput(prev => prev + emoji);
    inputRef.current?.focus();
  };

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-8">No messages yet. Say something! 👋</div>
        )}
        {messages.map((msg) => {
          const isMe = msg.user_email === user?.email;
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              <div className="flex-shrink-0">
                {msg.profile_picture ? (
                  <img src={msg.profile_picture} className="w-7 h-7 rounded-full object-cover border border-white/20" alt="" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                    {(msg.display_name?.[0] || '?').toUpperCase()}
                  </div>
                )}
              </div>
              <div className={`max-w-[200px] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && (
                  <span className="text-[10px] text-pink-400 font-semibold px-1">{msg.display_name}</span>
                )}
                <div className={`px-3 py-2 rounded-2xl text-sm break-words ${isMe ? 'bg-pink-500 text-white rounded-tr-sm' : 'bg-white/10 text-gray-100 rounded-tl-sm'}`}>
                  {msg.message}
                </div>
                <span className="text-[9px] text-gray-600 px-1">{timeAgo(msg.created_date)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Emoji Bar */}
      <div className="flex gap-1 px-3 py-1.5 border-t border-white/5 flex-shrink-0 overflow-x-auto">
        {CUSTOM_EMOJIS.map((e) => (
          <button key={e.label} title={e.title} onClick={() => insertEmoji(e.label)}
            className="text-base hover:scale-125 transition-transform flex-shrink-0">
            {e.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10 flex-shrink-0">
        {user ? (
          <>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              maxLength={200}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="w-8 h-8 rounded-full bg-pink-500 hover:bg-pink-600 disabled:opacity-40 flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </>
        ) : (
          <button onClick={() => base44.auth.redirectToLogin()}
            className="w-full py-2 text-sm text-pink-400 hover:text-pink-300 text-center">
            Sign in to chat
          </button>
        )}
      </div>
    </>
  );
}

export default function GlobalChat({ user }) {
  const [open, setOpen] = useState(false);
  const [activeRoom, setActiveRoom] = useState('global');
  const [unread, setUnread] = useState(0);

  // Count unread across all rooms when closed
  useEffect(() => {
    if (open) { setUnread(0); return; }
    const unsub = base44.entities.GlobalChat.subscribe((event) => {
      if (event.type === 'create') setUnread(u => u + 1);
    });
    return unsub;
  }, [open]);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-24 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 shadow-lg shadow-pink-500/40 flex items-center justify-center hover:scale-110 transition-transform"
      >
        {open ? <X className="w-5 h-5 text-white" /> : (
          <>
            <MessageCircle className="w-5 h-5 text-white" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-36 md:bottom-20 right-4 md:right-24 z-50 w-80 max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl bg-[#1A1528] border border-white/10 shadow-2xl overflow-hidden"
            style={{ height: '460px' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-white font-bold text-sm">Live Chat</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Room Tabs */}
            <div className="flex border-b border-white/10 flex-shrink-0">
              {ROOMS.map(room => (
                <button
                  key={room.id}
                  onClick={() => setActiveRoom(room.id)}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                    activeRoom === room.id
                      ? 'text-pink-400 border-b-2 border-pink-500 bg-pink-500/5'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {room.label}
                </button>
              ))}
            </div>

            {/* Room Content */}
            <div className="flex flex-col flex-1 min-h-0">
              <ChatRoom key={activeRoom} roomId={activeRoom} user={user} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}