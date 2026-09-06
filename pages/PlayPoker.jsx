import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ShieldCheck, History, Eye, EyeOff, ChevronDown, ChevronUp, Menu, X, ChevronRight, LogOut, Users, BookOpen, Settings, Zap, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import TableChat from '@/components/poker/TableChat';
import AllInOverlay from '@/components/poker/AllInOverlay';
import HandVerifier from '@/components/poker/HandVerifier';
import BombPotAlert from '@/components/poker/BombPotAlert';
import InsuranceOffer from '@/components/poker/InsuranceOffer';
import { usePokerSounds } from '@/components/poker/usePokerSounds';
import PokerSettingsModal from '@/components/poker/PokerSettingsModal';
import { motion, AnimatePresence } from 'framer-motion';

// Card display component
function PokerCard({ card, faceDown = false, small = false }) {
  if (!card && !faceDown) return null;
  const size = small ? 'w-8 h-11 text-sm' : 'w-12 h-16 text-lg';
  if (faceDown) {
    return (
      <div className={`${size} bg-gradient-to-br from-blue-800 to-blue-900 rounded-md border border-blue-600 flex items-center justify-center shadow-md`}>
        <span className="text-blue-400 text-xs">🂠</span>
      </div>
    );
  }
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const isRed = suit === '♥' || suit === '♦';
  return (
    <motion.div
      initial={{ rotateY: 90, scale: 0.8 }}
      animate={{ rotateY: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className={`${size} bg-white rounded-md border border-gray-200 flex flex-col items-center justify-center shadow-lg font-bold ${isRed ? 'text-red-600' : 'text-gray-900'}`}
    >
      <span>{rank}</span>
      <span>{suit}</span>
    </motion.div>
  );
}

export default function PlayPoker() {
  const urlParams = new URLSearchParams(window.location.search);
  const tableId = urlParams.get('tableId');
  const queryClient = useQueryClient();

  const [user, setUser] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [buyInAmount, setBuyInAmount] = useState(0);
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState('');
  const [myHoleCards, setMyHoleCards] = useState(null); // dealt to me this hand
  const [showHandHistory, setShowHandHistory] = useState(false);
  const [allInActive, setAllInActive] = useState(false);
  const [allInPlayerName, setAllInPlayerName] = useState('');
  const [showMyCards, setShowMyCards] = useState(true);
  const [lastHandCount, setLastHandCount] = useState(0);
  const [selectedCardsToReveal, setSelectedCardsToReveal] = useState(new Set());
  const [revealedByOthers, setRevealedByOthers] = useState({});
  const [showBombPotAlert, setShowBombPotAlert] = useState(false);
  const [showInsuranceOffer, setShowInsuranceOffer] = useState(false);
  const [insuranceAllInAmount, setInsuranceAllInAmount] = useState(0);
  const [insurancePurchased, setInsurancePurchased] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pokerSettings, setPokerSettings] = useState({
    tableColor: 'green', cardPattern: 'classic', cardBack: 0,
    betIncrement: 'Big Blinds', preflopBB: '2BB', postflop: '1/2',
    gameSound: true, sliderConfirm: true, comment: true, fairCode: true, actionVoice: 'Male'
  });
  const sounds = usePokerSounds();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u) base44.entities.UserWallet.filter({ user_email: u.email }).then(setWallets);
    }).catch(() => {});
  }, []);

  const { data: table, refetch } = useQuery({
    queryKey: ['poker-table', tableId],
    queryFn: () => base44.entities.SitAndGoTable.filter({ id: tableId }).then(r => r[0]),
    enabled: !!tableId,
    refetchInterval: 5000
  });

  // Real-time subscription for instant detection of new hands and game state changes
  useEffect(() => {
    if (!tableId) return;
    const unsub = base44.entities.SitAndGoTable.subscribe((event) => {
      if (event.id === tableId && (event.type === 'update' || event.type === 'create')) {
        queryClient.invalidateQueries({ queryKey: ['poker-table', tableId] });
      }
    });
    return unsub;
  }, [tableId]);

  // Hand history (player's perspective — only shows their own cards when shown)
  const { data: handHistory = [] } = useQuery({
    queryKey: ['hand-history', tableId, user?.email],
    queryFn: async () => {
      if (!user?.role) return [];
      const records = await base44.entities.PokerHandRecord.filter({ table_id: tableId }, '-hand_number', 20);
      if (user.role === 'admin') return records; // admin sees everything
      // Regular users: filter player_records to only show their own cards + any showdown-revealed cards
      return records.map(r => ({
        ...r,
        player_records: r.player_records?.map(pr => ({
          ...pr,
          hole_cards: pr.hole_cards_shown || pr.user_email === user.email ? pr.hole_cards : undefined
        }))
      }));
    },
    enabled: !!tableId && !!user,
    refetchInterval: 10000
  });

  useEffect(() => {
    if (table) setBuyInAmount(table.min_buyin);
  }, [table?.id]);

  // Detect new hand dealt → play shuffle + deal sounds
  useEffect(() => {
    if (table?.hand_number && table.hand_number !== lastHandCount && table.hand_number > 0) {
      sounds.shuffle();
      setTimeout(() => sounds.deal(2), 700);
      setLastHandCount(table.hand_number);
    }
  }, [table?.hand_number]);

  // Subscribe to ephemeral card reveal events
  useEffect(() => {
    if (!tableId) return;
    const unsub = base44.entities.PokerRevealEvent.subscribe((event) => {
      if (event.data?.table_id === tableId && event.type === 'create') {
        const { user_id, display_name, seat, cards } = event.data;
        setRevealedByOthers(prev => ({ ...prev, [user_id]: { display_name, seat, cards } }));
        // Clear after 12 seconds
        setTimeout(() => {
          setRevealedByOthers(prev => {
            const next = { ...prev };
            delete next[user_id];
            return next;
          });
        }, 5000);
      }
    });
    return unsub;
  }, [tableId]);

  // Clear reveals & selection when a new hand starts
  useEffect(() => {
    if (table?.hand_number) {
      setRevealedByOthers({});
      setSelectedCardsToReveal(new Set());
    }
  }, [table?.hand_number]);

  // Parse game state for folded players
  const gameState = (() => {
    try { return table?.game_state ? JSON.parse(table.game_state) : {}; } catch { return {}; }
  })();
  const foldedEmails = new Set(gameState.folded_players || []);

  // Detect all-in in game_state + offer insurance if applicable
  useEffect(() => {
    if (!table?.game_state) return;
    try {
      const gs = JSON.parse(table.game_state);
      if (gs.all_in_player) {
        setAllInActive(true);
        setAllInPlayerName(gs.all_in_player);
        sounds.allIn();
        setTimeout(() => sounds.shush(), 800);
        setTimeout(() => setAllInActive(false), 8000);

        // If insurance mode is on, offer it to the all-in player if it's me
        if (table.insurance_mode && gs.all_in_player === (user?.full_name || user?.email?.split('@')[0])) {
          const myStack = mySeat?.stack || 0;
          if (myStack > 0 && (table.insurance_balance || 0) > 0) {
            setInsuranceAllInAmount(myStack);
            setShowInsuranceOffer(true);
            setInsurancePurchased(false);
          }
        }
      }
    } catch {}
  }, [table?.game_state]);

  // Detect bomb pot activation
  useEffect(() => {
    if (table?.bomb_pot_active && table.bomb_pot_enabled) {
      setShowBombPotAlert(true);
    }
  }, [table?.bomb_pot_active]);

  const handleBuyInsurance = async (cost, payout) => {
    if (!wallet || !user) return;
    // Deduct cost from player, record it
    await base44.entities.UserWallet.update(wallet.id, {
      cat_dollars: (wallet.cat_dollars || 0) - cost
    });
    // Add payout to insurance reserved for this player via a transaction note
    await base44.entities.Transaction.create({
      user_email: user.email,
      type: 'loss',
      amount: 0,
      cat_dollars: -cost,
      description: `Insurance purchase at ${table.name} — covers ${payout} ID if lost`,
      balance_after: (wallet.cat_dollars || 0) - cost
    });
    setInsurancePurchased(true);
    setShowInsuranceOffer(false);
    setWallets([{ ...wallet, cat_dollars: (wallet.cat_dollars || 0) - cost }]);
  };

  const wallet = wallets[0];
  const isSeated = table?.seated_players?.some(p => p.user_email === user?.email);
  const mySeat = table?.seated_players?.find(p => p.user_email === user?.email);

  const joinTable = async () => {
    if (!user) { base44.auth.redirectToLogin(); return; }
    if (!wallet) { setMessage('No wallet found.'); return; }
    if ((wallet.cat_dollars || 0) < buyInAmount) {
      setMessage('Insufficient Imperial Dollars (ID).');
      return;
    }
    if (buyInAmount < table.min_buyin || buyInAmount > table.max_buyin) {
      setMessage(`Buy-in must be between ${table.min_buyin} and ${table.max_buyin} ID.`);
      return;
    }
    setJoining(true);

    const takenSeats = table.seated_players.map(p => p.seat);
    let newSeat = 1;
    while (takenSeats.includes(newSeat)) newSeat++;

    const newPlayer = {
      user_email: user.email,
      display_name: user.full_name || user.email.split('@')[0],
      stack: buyInAmount,
      seat: newSeat,
      is_sitting_out: false
    };

    const newSeated = [...(table.seated_players || []), newPlayer];
    const shouldStart = newSeated.length >= 2 && table.status === 'waiting';

    // Deduct ID (Imperial Dollars only)
    await base44.entities.UserWallet.update(wallet.id, {
      cat_dollars: (wallet.cat_dollars || 0) - buyInAmount
    });

    await base44.entities.Transaction.create({
      user_email: user.email,
      type: 'loss',
      amount: 0,
      cat_dollars: -buyInAmount,
      description: `Poker table buy-in: ${table.name}`,
      balance_after: (wallet.cat_dollars || 0) - buyInAmount
    });

    await base44.entities.SitAndGoTable.update(table.id, {
      seated_players: newSeated,
      status: shouldStart ? 'active' : 'waiting'
    });

    if (shouldStart) {
      sounds.shuffle();
      setTimeout(() => {
        sounds.deal(newSeated.length * 2);
        // Generate hand hash via backend
        base44.functions.invoke('generatePokerHand', {
          tableId: table.id,
          handNumber: (table.hand_number || 0) + 1,
          playerEmails: newSeated.map(p => p.user_email)
        });
      }, 500);
      await base44.entities.PokerTableChat.create({
        room_id: table.id, room_type: 'table',
        user_email: 'system', display_name: 'Dealer',
        message: `🃏 Game starting! Shuffle up and deal! Good luck everyone.`,
        is_system: true
      });
    }

    setWallets([{ ...wallet, cat_dollars: (wallet.cat_dollars || 0) - buyInAmount }]);
    refetch();
    setJoining(false);
    setMessage('');
    sounds.bet();
  };

  const toggleCardReveal = (index) => {
    setSelectedCardsToReveal(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const broadcastReveal = async () => {
    if (!user || !myHoleCards || selectedCardsToReveal.size === 0) return;
    const cardsToShow = [...selectedCardsToReveal].map(i => myHoleCards[i]);
    const record = await base44.entities.PokerRevealEvent.create({
      table_id: tableId,
      user_id: user.id,
      display_name: user.full_name || user.email.split('@')[0],
      seat: mySeat?.seat,
      cards: cardsToShow
    });
    // Ephemeral — delete immediately
    setTimeout(() => base44.entities.PokerRevealEvent.delete(record.id), 500);
    sounds.crowd();
  };

  const leaveTable = async () => {
    if (!user || !table || !isSeated) return;
    const updatedPlayers = table.seated_players.filter(p => p.user_email !== user.email);
    const myStack = mySeat?.stack || 0;

    await base44.entities.SitAndGoTable.update(table.id, {
      seated_players: updatedPlayers,
      status: updatedPlayers.length < 2 ? 'waiting' : table.status
    });

    if (myStack > 0) {
      // Always fetch fresh wallet to avoid stale balance
      const freshWallets = await base44.entities.UserWallet.filter({ user_email: user.email });
      const freshWallet = freshWallets[0];
      if (freshWallet) {
        const newBalance = (freshWallet.cat_dollars || 0) + myStack;
        await base44.entities.UserWallet.update(freshWallet.id, { cat_dollars: newBalance });
        await base44.entities.Transaction.create({
          user_email: user.email,
          type: 'win',
          amount: 0,
          cat_dollars: myStack,
          description: `Poker cash out: ${table.name}`,
          balance_after: newBalance
        });
        setWallets([{ ...freshWallet, cat_dollars: newBalance }]);
      }
    }

    await base44.entities.PokerTableChat.create({
      room_id: table.id, room_type: 'table',
      user_email: 'system', display_name: 'Dealer',
      message: `${user.full_name || user.email.split('@')[0]} left the table.`,
      is_system: true
    });

    refetch();
  };

  if (!tableId) return (
    <div className="min-h-screen bg-[#0A0612] flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 mb-4">No table selected.</p>
        <Link to={createPageUrl('PokerLobby')}><Button className="bg-pink-500 hover:bg-pink-600">Back to Lobby</Button></Link>
      </div>
    </div>
  );

  if (!table) return (
    <div className="min-h-screen bg-[#0A0612] flex items-center justify-center">
      <div className="text-white">Loading table...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0612] flex flex-col">
      <AllInOverlay show={allInActive} playerName={allInPlayerName} />
      <PokerSettingsModal open={showSettings} onClose={() => setShowSettings(false)} settings={pokerSettings} onSettingsChange={setPokerSettings} />
      <BombPotAlert
        show={showBombPotAlert}
        bbMultiplier={table?.bomb_pot_bb_multiplier || 8}
        bigBlind={table?.big_blind || 10}
        onAcknowledge={() => setShowBombPotAlert(false)}
      />

      {/* Slide-out Menu */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => setShowMenu(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-[#1a1a2e] z-50 flex flex-col shadow-2xl"
            >
              {/* Menu Header */}
              <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
                <Menu className="w-5 h-5 text-white" />
                <span className="text-white text-xl font-bold">Menu</span>
                <button onClick={() => setShowMenu(false)} className="ml-auto text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Menu Items */}
              <div className="flex-1 py-2">
                {[
                  { icon: ArrowLeft, label: 'Back to Lobby', action: () => window.location.href = createPageUrl('PokerLobby') },
                  { icon: Users, label: isSeated ? 'Stand up & Watch' : 'Sit Down', action: () => { isSeated ? leaveTable() : null; setShowMenu(false); } },
                  { icon: BookOpen, label: 'Hand History', action: () => { setShowHandHistory(o => !o); setShowMenu(false); } },
                  { icon: Settings, label: 'Options', action: () => { setShowSettings(true); setShowMenu(false); } },
                  { icon: Zap, label: 'Buy-in Settings', action: () => setShowMenu(false) },
                  { icon: Plus, label: 'Play one more table', action: () => { window.location.href = createPageUrl('PokerLobby'); } },
                  { icon: LogOut, label: 'Exit Game', action: () => { window.location.href = createPageUrl('PokerLobby'); } },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={item.action}
                    className="w-full flex items-center gap-4 px-5 py-4 text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-left"
                  >
                    <item.icon className="w-5 h-5 text-gray-500 shrink-0" />
                    <span className="flex-1 text-sm font-medium">{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-[#0F0A1E] border-b border-white/5 px-3 py-3 flex items-center gap-2 z-10">
        {/* Hamburger menu */}
        <Button variant="ghost" size="icon" onClick={() => setShowMenu(true)} className="text-gray-400 hover:text-white shrink-0">
          <Menu className="w-5 h-5" />
        </Button>

        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-sm truncate flex items-center gap-1.5">
            {table.name}
            {table.insurance_mode && <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-full">🛡️</span>}
            {table.bomb_pot_enabled && <span className="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 px-1.5 py-0.5 rounded-full">💣</span>}
          </h1>
          <p className="text-gray-400 text-xs">
            {table.small_blind}/{table.big_blind} ID · {table.seated_players?.length || 0}/{table.max_players} seated
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Add Table button */}
          <Link to={createPageUrl('PokerLobby')}>
            <button className="relative flex items-center justify-center w-9 h-9 opacity-70 hover:opacity-100 transition-opacity" title="Add Table">
              <svg viewBox="0 0 36 36" className="w-9 h-9" fill="none">
                <ellipse cx="18" cy="18" rx="16" ry="11" stroke="#4ade80" strokeWidth="2" fill="#14532d" fillOpacity="0.6" />
                <line x1="18" y1="13" x2="18" y2="23" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="13" y1="18" x2="23" y2="18" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
          </Link>

          {/* Balance */}
          <div className="text-right">
            <div className="text-gray-400 text-xs">Balance</div>
            <div className="text-white font-bold text-sm">{wallet?.cat_dollars?.toLocaleString() || 0} <span className="text-pink-400 text-xs">ID</span></div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Poker Table Area */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">

          {/* Hand History Panel */}
          <AnimatePresence>
            {showHandHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-[#0F0A1E] border border-white/10 rounded-xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-400" />
                  <span className="text-white font-bold text-sm">Hand History · Provably Fair</span>
                  {user?.role === 'admin' && <span className="ml-2 bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">Admin View — All Cards Visible</span>}
                </div>
                <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                  {handHistory.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No hands played yet.</p>}
                  {handHistory.map(record => (
                    <div key={record.id} className="bg-black/30 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-bold text-sm">Hand #{record.hand_number}</span>
                        {record.winner_email && <span className="text-yellow-400 text-xs">🏆 {record.winner_email?.split('@')[0]} won {record.pot_total} ID</span>}
                      </div>
                      {record.community_cards?.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          <span className="text-gray-500 text-xs mr-1">Board:</span>
                          {record.community_cards.map((c, i) => <PokerCard key={i} card={c} small />)}
                        </div>
                      )}
                      {record.player_records?.map(pr => (
                        <div key={pr.user_email} className="flex items-center gap-2 text-xs">
                          <span className={`font-bold ${pr.user_email === user?.email ? 'text-pink-400' : 'text-cyan-400'}`}>{pr.display_name}</span>
                          <span className={`px-1.5 py-0.5 rounded ${pr.result === 'won' ? 'bg-green-500/20 text-green-400' : pr.result === 'folded' ? 'bg-gray-500/20 text-gray-400' : 'bg-red-500/20 text-red-400'}`}>{pr.result}</span>
                          {pr.hole_cards?.length > 0 ? (
                            <div className="flex gap-1">
                              {pr.hole_cards.map((c, i) => <PokerCard key={i} card={c} small />)}
                            </div>
                          ) : pr.result !== 'folded' ? (
                            <span className="text-gray-600 italic">cards hidden</span>
                          ) : null}
                        </div>
                      ))}
                      <HandVerifier record={record} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Felt Table — BC.game style oval */}
          <div className="relative flex items-center justify-center" style={{ minHeight: '420px' }}>
            {/* Outer dark rim */}
            <div className="absolute inset-0 rounded-[50%] bg-[#1a0f00] shadow-2xl" style={{ borderRadius: '50% / 42%' }} />
            {/* Rail */}
            <div className="absolute inset-2 rounded-[50%] bg-gradient-to-b from-[#4a2e10] to-[#2d1a08]" style={{ borderRadius: '50% / 42%' }} />
            {/* Felt */}
            <div className="absolute inset-4 rounded-[50%] bg-gradient-to-br from-[#2d6a35] via-[#1f5228] to-[#163d1e] shadow-inner" style={{ borderRadius: '50% / 42%' }} />
            {/* Inner felt line */}
            <div className="absolute inset-8 rounded-[50%] border border-[#3a7a44]/40" style={{ borderRadius: '50% / 42%' }} />

            {/* Center info */}
            <div className="relative z-10 text-center pointer-events-none">
              {table.pot > 0 && (
                <div className="flex items-center gap-1.5 justify-center bg-black/50 rounded-full px-4 py-1.5 mb-1">
                  <span className="text-green-400 text-sm">💰</span>
                  <span className="text-white font-bold text-sm">{table.pot} ID</span>
                </div>
              )}
              {table.community_cards?.length > 0 ? (
                <div className="flex gap-1.5 justify-center mt-2">
                  {table.community_cards.map((card, i) => <PokerCard key={i} card={card} small />)}
                </div>
              ) : (
                <div className="text-[#81C784]/40 text-xs mt-1">
                  {table.status === 'waiting' ? 'Waiting for players...' : ''}
                </div>
              )}
              <div className="text-[#3a7a44]/50 text-xs mt-2 font-bold tracking-widest">IMPERIAL POKER</div>
            </div>

            {/* Players around the oval */}
            <div className="absolute inset-0">
              {Array.from({ length: table.max_players }).map((_, i) => {
                const player = table.seated_players?.find(p => p.seat === i + 1);
                const angle = (i / table.max_players) * 360 - 90;
                const rad = angle * Math.PI / 180;
                const rx = 46, ry = 40;
                const x = 50 + rx * Math.cos(rad);
                const y = 50 + ry * Math.sin(rad);
                const isMe = player?.user_email === user?.email;
                const isDealer = table.dealer_seat === (i + 1);
                const isFolded = foldedEmails.has(player?.user_email);
                const hasCards = table.status === 'active' && !isFolded;
                const playerAction = (() => {
                  try {
                    const gs = JSON.parse(table.game_state || '{}');
                    return gs.last_actions?.[player?.user_email];
                  } catch { return null; }
                })();
                const actionColor = {
                  fold: 'bg-red-500', call: 'bg-green-500', check: 'bg-blue-500',
                  raise: 'bg-yellow-500', bet: 'bg-yellow-500', allin: 'bg-red-600'
                }[playerAction?.toLowerCase()] || '';

                return (
                  <div
                    key={i}
                    style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)', position: 'absolute' }}
                  >
                    {player ? (
                      <div className="flex flex-col items-center gap-0.5">
                        {/* Action badge above avatar */}
                        {playerAction && (
                          <div className={`${actionColor} text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow mb-0.5 capitalize`}>
                            {playerAction}
                          </div>
                        )}
                        {!playerAction && isFolded && (
                          <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow mb-0.5">Fold</div>
                        )}
                        {/* Avatar circle */}
                        <div className="relative">
                          <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-base font-black shadow-lg ${
                            isMe ? 'bg-gradient-to-br from-pink-400 to-pink-600 border-white' :
                            'bg-gradient-to-br from-blue-500 to-blue-800 border-blue-300'
                          } ${isFolded ? 'opacity-50' : ''}`}>
                            <span className="text-white">{player.display_name?.charAt(0).toUpperCase()}</span>
                          </div>
                          {isDealer && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-white text-black text-[9px] rounded-full flex items-center justify-center font-black border border-gray-300 shadow">D</div>
                          )}
                          {player.is_sitting_out && (
                            <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center text-xs text-yellow-400 font-bold">Z</div>
                          )}
                          {/* Face-down cards fan */}
                          {!isMe && hasCards && (
                            <div className="absolute -right-3 -top-1 flex">
                              <div className="w-4 h-5 bg-gradient-to-br from-blue-700 to-blue-900 rounded-sm border border-blue-500 shadow rotate-[-8deg]" />
                              <div className="w-4 h-5 bg-gradient-to-br from-blue-700 to-blue-900 rounded-sm border border-blue-500 shadow rotate-[4deg] -ml-1" />
                            </div>
                          )}
                        </div>
                        {/* Name + stack */}
                        <div className="text-center mt-0.5">
                          <div className={`text-[10px] font-semibold truncate max-w-[60px] ${isMe ? 'text-pink-300' : 'text-white'}`}>
                            {player.display_name}
                          </div>
                          <div className="bg-black/70 rounded-full px-2 py-0.5 text-[10px] text-white font-bold">
                            {player.stack} ID
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-black/30 border border-white/10 flex items-center justify-center">
                        <span className="text-white/20 text-xs">{i + 1}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* My Hole Cards (if dealt) */}
          {isSeated && myHoleCards && (
            <div className="bg-[#1A1030] border border-pink-500/20 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-pink-400 font-bold text-sm">Your Cards</span>
                <button onClick={() => setShowMyCards(o => !o)} className="text-gray-500 hover:text-gray-300">
                  {showMyCards ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {selectedCardsToReveal.size > 0 && (
                  <button
                    onClick={broadcastReveal}
                    className="ml-auto text-xs bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 border border-yellow-500/30 rounded-full px-3 py-1 transition-all"
                  >
                    Show selected to table
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {myHoleCards.map((c, i) => (
                  <div key={i} className="relative cursor-pointer group" onClick={() => toggleCardReveal(i)}>
                    {showMyCards ? <PokerCard card={c} /> : <PokerCard faceDown />}
                    {/* Eye overlay — tap to mark for reveal */}
                    <div className={`absolute inset-0 rounded-md flex items-center justify-center transition-all ${
                      selectedCardsToReveal.has(i)
                        ? 'bg-yellow-400/30 border-2 border-yellow-400'
                        : 'bg-black/0 border-2 border-transparent group-hover:bg-white/10'
                    }`}>
                      <Eye className={`w-4 h-4 transition-all ${selectedCardsToReveal.has(i) ? 'text-yellow-300 opacity-100' : 'text-white opacity-0 group-hover:opacity-40'}`} />
                    </div>
                  </div>
                ))}
                <div className="flex flex-col justify-end ml-1">
                  <p className="text-gray-600 text-xs italic">Tap card to<br/>mark for reveal</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Panel */}
          {!isSeated ? (
            <div className="bg-[#1A1030] border border-white/10 rounded-xl p-4">
              <h3 className="text-white font-bold mb-1">Join Table</h3>
              <p className="text-gray-500 text-xs mb-3">Buy-in with Imperial Dollars (ID) only</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-gray-400 text-xs mb-1 block">Buy-in Amount</label>
                  <Input
                    type="number"
                    value={buyInAmount}
                    onChange={e => setBuyInAmount(parseFloat(e.target.value) || 0)}
                    min={table.min_buyin}
                    max={table.max_buyin}
                    step={table.small_blind}
                    className="bg-white/5 border-white/10 text-white"
                  />
                  <div className="text-gray-500 text-xs mt-1">
                    Min: {table.min_buyin} ID · Max: {table.max_buyin} ID · Balance: <span className="text-pink-400">{wallet?.cat_dollars?.toLocaleString() || 0} ID</span>
                  </div>
                </div>
                <Button
                  onClick={joinTable}
                  disabled={joining || (table.seated_players?.length || 0) >= table.max_players}
                  className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 h-12 px-6"
                >
                  {joining ? 'Joining...' : 'Sit Down'}
                </Button>
              </div>
              {message && <p className="text-red-400 text-sm mt-2">{message}</p>}
            </div>
          ) : (
            <div className="bg-[#1A1030] border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-green-400 font-bold">Seated · Seat {mySeat?.seat}</span>
                  <div className="text-gray-400 text-sm">Stack: <span className="text-yellow-300 font-bold">{mySeat?.stack} ID</span></div>
                </div>
                <Button onClick={leaveTable} variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                  Cash Out & Leave
                </Button>
              </div>
              {table.insurance_mode && showInsuranceOffer && !insurancePurchased && (
                <InsuranceOffer
                  show={showInsuranceOffer}
                  allInAmount={insuranceAllInAmount}
                  insuranceBalance={table.insurance_balance || 0}
                  onBuy={handleBuyInsurance}
                  onDecline={() => setShowInsuranceOffer(false)}
                />
              )}
              {insurancePurchased && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 text-blue-300 text-sm flex items-center gap-2">
                  🛡️ Insurance active — you're covered this hand!
                </div>
              )}
              {table.status === 'waiting' && (
                <p className="text-yellow-400 text-sm">⏳ Waiting for more players to join...</p>
              )}
              {table.status === 'active' && (
                <div className="space-y-2">
                  <p className="text-green-400 text-sm">🃏 Game in progress</p>
                  {/* Live reveals from other players */}
                  {Object.keys(revealedByOthers).length > 0 && (
                    <div className="space-y-1">
                      {Object.entries(revealedByOthers).map(([uid, data]) => (
                        <AnimatePresence key={uid}>
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2"
                          >
                            <Eye className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                            <span className="text-yellow-300 text-xs font-bold">{data.display_name}</span>
                            <span className="text-gray-400 text-xs">shows</span>
                            <div className="flex gap-1">
                              {data.cards.map((c, i) => <PokerCard key={i} card={c} small />)}
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Table Chat Sidebar */}
        <div className="w-64 xl:w-72 border-l border-white/5 flex flex-col">
          <TableChat
            user={user}
            roomId={tableId}
            roomType="table"
            isAllIn={allInActive}
            allInPlayer={allInPlayerName}
          />
        </div>
      </div>
    </div>
  );
}