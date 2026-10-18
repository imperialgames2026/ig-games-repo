import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, MessageCircle, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePokerSounds } from './usePokerSounds';
import { motion, AnimatePresence } from 'framer-motion';

const TAUNT_EMOJIS = [
  { emoji: '😂', label: 'LOL' },
  { emoji: '😈', label: 'Evil' },
  { emoji: '🤡', label: 'Clown' },
  { emoji: '💀', label: 'Dead' },
  { emoji: '🫵', label: 'Got you' },
  { emoji: '🙈', label: "Can't look" },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💸', label: 'Money gone' },
];

const CHEER_EMOJIS = [
  { emoji: '🍺🍺', label: 'Cheers!', isBeer: true },
  { emoji: '👏', label: 'Clap' },
  { emoji: '🤝', label: 'Good game' },
  { emoji: '💪', label: 'Strong' },
];

export default function TableChat({ user, roomId, roomType = 'table', isAllIn = false, allInPlayer = '' }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]); // ephemeral floating visuals
  const bottomRef = useRef(null);
  const sounds = usePokerSounds();

  useEffect(() => {
    if (!roomId) return;
    const load = async () => {
      const msgs = await base44.entities.PokerTableChat.filter(
        { room_id: roomId, room_type: roomType },
        '-created_date',
        50
      );
      setMessages(msgs.reverse());
    };
    load();

    const unsubChat = base44.entities.PokerTableChat.subscribe((event) => {
      if (event.data?.room_id === roomId) {
        if (event.type === 'create') {
          setMessages(prev => [...prev, event.data]);
        }
      }
    });

    // Subscribe to ephemeral reactions — show floating animation only, no chat log
    const unsubReaction = base44.entities.PokerReaction.subscribe((event) => {
      if (event.data?.table_id === roomId && event.type === 'create') {
        const { reaction_type, display_name } = event.data;
        const isBeer = reaction_type === '🍺🍺';
        if (isBeer) sounds.beerClink();
        else sounds.taunt();

        const id = Date.now() + Math.random();
        setFloatingReactions(prev => [...prev, { id, emoji: reaction_type, name: display_name }]);
        setTimeout(() => {
          setFloatingReactions(prev => prev.filter(r => r.id !== id));
        }, 3000);
      }
    });

    return () => { unsubChat(); unsubReaction(); };
  }, [roomId, roomType]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text = null) => {
    const msg = text || input.trim();
    if (!msg || !user || sending || isAllIn) return;
    setSending(true);
    await base44.entities.PokerTableChat.create({
      room_id: roomId,
      room_type: roomType,
      user_email: user.email,
      display_name: user.full_name || user.email.split('@')[0],
      message: msg,
      is_system: false
    });
    if (!text) setInput('');
    setSending(false);
    setShowEmojis(false);
  };

  // Send emoji as ephemeral PokerReaction — NOT to chat
  const sendReaction = async (emoji) => {
    if (!user || isAllIn) return;
    const record = await base44.entities.PokerReaction.create({
      table_id: roomId,
      initiator_user_id: user.id,
      display_name: user.full_name || user.email.split('@')[0],
      reaction_type: emoji
    });
    // Ephemeral — delete immediately
    setTimeout(() => base44.entities.PokerReaction.delete(record.id), 300);
    setShowEmojis(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') send();
  };

  return (
    <div className="flex flex-col h-full bg-[#0F0A1E] border border-white/10 rounded-xl overflow-hidden relative">
      {/* Floating reactions overlay */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
        <AnimatePresence>
          {floatingReactions.map(r => (
            <motion.div
              key={r.id}
              initial={{ opacity: 1, y: 0, scale: 0.8 }}
              animate={{ opacity: 0, y: -120, scale: 1.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, ease: 'easeOut' }}
              className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center"
            >
              <span className="text-3xl">{r.emoji}</span>
              <span className="text-xs text-white/70 mt-0.5">{r.name}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
        <MessageCircle className="w-3.5 h-3.5 text-pink-400" />
        <span className="text-white font-semibold text-xs flex-1">Table Chat</span>
        {isAllIn && (
          <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 rounded-full px-2 py-0.5">
            <VolumeX className="w-3 h-3 text-red-400" />
            <span className="text-red-400 text-xs font-bold">Silent</span>
          </div>
        )}
      </div>

      {/* All-in silence banner */}
      {isAllIn && (
        <div className="bg-red-900/40 border-b border-red-500/20 px-3 py-2 text-center">
          <p className="text-red-300 text-xs font-bold animate-pulse">
            🤫 Shhh... {allInPlayer || 'Someone'} is ALL IN — Chat paused
          </p>
        </div>
      )}

      {/* Messages — player-to-player text only */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.is_system ? 'items-center' : ''}`}>
            {msg.is_system ? (
              <div className="bg-yellow-500/10 text-yellow-300 text-xs rounded px-2 py-1 text-center">
                {msg.message}
              </div>
            ) : (
              <div>
                <span className={`text-xs font-bold ${msg.user_email === user?.email ? 'text-pink-400' : 'text-cyan-400'}`}>
                  {msg.display_name}:
                </span>
                <span className="text-gray-300 text-xs ml-1">{msg.message}</span>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Emoji Picker — reactions only, not sent to chat */}
      {showEmojis && !isAllIn && (
        <div className="p-2 border-t border-white/10 bg-black/30">
          <div className="text-gray-500 text-xs mb-1.5">Taunts</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {TAUNT_EMOJIS.map(e => (
              <button
                key={e.emoji}
                onClick={() => sendReaction(e.emoji)}
                title={e.label}
                className="text-lg hover:scale-125 transition-transform p-0.5"
              >
                {e.emoji}
              </button>
            ))}
          </div>
          <div className="text-gray-500 text-xs mb-1.5">Cheers</div>
          <div className="flex flex-wrap gap-1">
            {CHEER_EMOJIS.map(e => (
              <button
                key={e.emoji}
                onClick={() => sendReaction(e.emoji)}
                title={e.label}
                className={`text-lg hover:scale-125 transition-transform p-0.5 ${e.isBeer ? 'animate-bounce' : ''}`}
              >
                {e.emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input — chat messages only */}
      <div className="p-2 border-t border-white/10 flex gap-1.5">
        <button
          onClick={() => setShowEmojis(o => !o)}
          disabled={isAllIn}
          className={`text-lg p-1 rounded transition-colors ${isAllIn ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10'}`}
          title="Taunts & Cheers"
        >
          😈
        </button>
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={isAllIn ? '🤫 All-in — be quiet...' : 'Chat...'}
          disabled={!user || sending || isAllIn}
          className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-xs h-8"
        />
        <Button
          size="icon"
          onClick={() => send()}
          disabled={!user || !input.trim() || sending || isAllIn}
          className="h-8 w-8 bg-pink-500 hover:bg-pink-600 shrink-0"
        >
          <Send className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}