import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Poker Lobby Chat — uses GlobalChat entity with room_id 'poker-lobby'
// Messages here also appear in the Global Chat floating widget under the "Poker" tab
export default function LobbyChat({ user, roomId = 'poker-lobby', title = 'Lobby Chat' }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    base44.entities.GlobalChat.filter({ room_id: roomId }, '-created_date', 50).then(msgs => {
      setMessages(msgs.reverse());
    });

    const unsub = base44.entities.GlobalChat.subscribe((event) => {
      if (event.data?.room_id === roomId && event.type === 'create') {
        setMessages(prev => [...prev, event.data]);
      }
    });
    return unsub;
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !user || sending) return;
    setSending(true);
    await base44.entities.GlobalChat.create({
      room_id: roomId,
      user_email: user.email,
      display_name: user.full_name || user.email.split('@')[0],
      message: input.trim(),
      profile_picture: user.profile_picture || null,
    });
    setInput('');
    setSending(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') send();
  };

  return (
    <div className="flex flex-col h-full bg-[#0F0A1E] border border-white/10 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <Bot className="w-4 h-4 text-pink-400" />
        <span className="text-white font-semibold text-sm">{title}</span>
        <span className="ml-auto text-xs text-gray-500">🌐 synced with global</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col">
            <div>
              <span className={`text-xs font-bold ${msg.user_email === user?.email ? 'text-pink-400' : 'text-yellow-400'}`}>
                {msg.display_name}
              </span>
              <p className="text-gray-300 text-sm">{msg.message}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-white/10 flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={user ? "Say something..." : "Sign in to chat"}
          disabled={!user || sending}
          className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-sm h-9"
        />
        <Button
          size="icon"
          onClick={send}
          disabled={!user || !input.trim() || sending}
          className="h-9 w-9 bg-pink-500 hover:bg-pink-600 shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}