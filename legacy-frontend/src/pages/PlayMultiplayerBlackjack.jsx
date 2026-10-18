import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Crown, Users } from 'lucide-react';
import { toast } from 'sonner';
import DealerAvatar from '@/components/blackjack/DealerAvatar';
import ChipStack from '@/components/blackjack/ChipStack';
import TableSeatLayer from '@/components/blackjack/TableSeatLayer';
import TableBetSpots from '@/components/blackjack/TableBetSpots';
import ChipRail from '@/components/blackjack/ChipRail';

const SUITS_DISPLAY = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED_SUITS = ['H', 'D'];

function calcScore(cards) {
  if (!cards?.length) return 0;
  let score = 0;
  let aces = 0;
  for (const card of cards) {
    const v = card.slice(0, -1);
    if (v === 'A') {
      aces++;
      score += 11;
    } else if (['J', 'Q', 'K'].includes(v)) {
      score += 10;
    } else {
      score += parseInt(v);
    }
  }
  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }
  return score;
}

function CardDisplay({ card, faceDown = false, large = false, delay = 0, fromShoe = false, placeholder = false }) {
  const sizeClass = large ? 'w-16 h-24 md:w-20 md:h-28' : 'w-11 h-16 md:w-12 md:h-[72px]';

  if (placeholder) {
    return (
      <div
        className={`${sizeClass} rounded-xl shrink-0 border-2 border-dashed`}
        style={{
          borderColor: 'rgba(236,72,153,0.32)',
          background: 'rgba(255,255,255,0.02)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)'
        }}
      />
    );
  }

  if (faceDown) {
    return (
      <motion.div
        initial={fromShoe ? { opacity: 0, x: 180, y: -90, rotate: -18, scale: 0.82 } : { opacity: 0, y: -70, rotate: -8, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
        transition={{ duration: 0.42, delay, type: 'spring', stiffness: 180, damping: 20 }}
        className={`${sizeClass} rounded-xl relative overflow-hidden shrink-0`}
        style={{
          background: 'linear-gradient(135deg, #1b1330 0%, #0f0b1c 100%)',
          border: '1px solid rgba(236,72,153,0.45)',
          boxShadow: '0 10px 24px rgba(0,0,0,0.45), 0 0 14px rgba(236,72,153,0.2)',
        }}
      >
        <div className="absolute inset-1 rounded-lg border border-pink-500/20" />
        <div
          className="absolute inset-0 opacity-40"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(236,72,153,0.12) 6px, rgba(236,72,153,0.12) 12px)' }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-pink-300 text-xl">✦</div>
      </motion.div>
    );
  }

  if (!card) return null;
  const suit = card.slice(-1);
  const val = card.slice(0, -1);
  const isRed = RED_SUITS.includes(suit);
  const color = isRed ? '#dc2626' : '#111827';

  return (
    <motion.div
      initial={fromShoe ? { opacity: 0, x: 180, y: -90, rotate: -18, scale: 0.82 } : { opacity: 0, y: -70, rotate: -10, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18, delay }}
      className={`${sizeClass} bg-white rounded-xl shadow-xl flex flex-col justify-between p-1.5 font-black select-none shrink-0`}
      style={{ border: '2px solid #f3f4f6', boxShadow: '0 14px 28px rgba(0,0,0,0.45)' }}
    >
      <div style={{ color, lineHeight: 1, fontSize: large ? '1rem' : '0.8rem' }}>
        {val}
        <br />
        <span style={{ fontSize: large ? '1rem' : '0.7rem' }}>{SUITS_DISPLAY[suit]}</span>
      </div>
      <div className="flex justify-center items-center" style={{ color, fontSize: large ? '2rem' : '1.3rem', lineHeight: 1 }}>
        {SUITS_DISPLAY[suit]}
      </div>
      <div className="rotate-180 self-end" style={{ color, lineHeight: 1, fontSize: large ? '1rem' : '0.8rem' }}>
        {val}
        <br />
        <span style={{ fontSize: large ? '1rem' : '0.7rem' }}>{SUITS_DISPLAY[suit]}</span>
      </div>
    </motion.div>
  );
}

function ScoreBadge({ score, status }) {
  if (!score) return null;
  const isBust = score > 21;
  const isBJ = status === 'blackjack';
  return (
    <div
      className={`px-3 py-1 rounded-full text-xs md:text-sm font-black ${
        isBust ? 'bg-red-600 text-white' : isBJ ? 'bg-yellow-400 text-black' : 'text-white'
      }`}
      style={{
        background: isBust ? undefined : isBJ ? undefined : 'rgba(10,6,18,0.88)',
        border: isBust || isBJ ? 'none' : '1px solid rgba(236,72,153,0.28)',
        boxShadow: '0 0 16px rgba(236,72,153,0.14)',
      }}
    >
      {isBJ ? 'BJ!' : isBust ? 'BUST' : score}
    </div>
  );
}

function ResultBanner({ result }) {
  if (!result || result === 'pending') return null;
  const configs = {
    win: { text: 'WIN', bg: 'linear-gradient(135deg, #10b981, #059669)' },
    lose: { text: 'LOSE', bg: 'linear-gradient(135deg, #ef4444, #b91c1c)' },
    push: { text: 'PUSH', bg: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
    blackjack: { text: 'BLACKJACK', bg: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    insurance_win: { text: 'INSURED', bg: 'linear-gradient(135deg, #14b8a6, #0f766e)' },
  };
  const cfg = configs[result];
  if (!cfg) return null;

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="absolute inset-0 rounded-2xl flex items-center justify-center z-20"
      style={{ background: 'rgba(10,6,18,0.78)', backdropFilter: 'blur(4px)' }}
    >
      <div className="px-4 py-2 rounded-xl text-white font-black text-sm md:text-base" style={{ background: cfg.bg }}>
        {cfg.text}
      </div>
    </motion.div>
  );
}

function PlayerHand({ hand, isMyHand, isActive, onHit, onStand, onDouble, onInsurance, onSplit, dealerShowsAce, insuranceOpen }) {
  const score = calcScore(hand.cards);
  const canSplit = hand.cards?.length === 2 && !hand.is_split_child && hand.cards[0].slice(0, -1) === hand.cards[1].slice(0, -1);
  const canInsure = dealerShowsAce && insuranceOpen && hand.cards?.length === 2 && !hand.insurance_bet;
  const isDone = ['bust', 'stand', 'blackjack', 'done'].includes(hand.status);

  return (
    <div
      className="relative rounded-2xl p-3 md:p-4"
      style={{
        background: 'rgba(15,10,26,0.88)',
        border: `1px solid ${isActive ? 'rgba(251,191,36,0.6)' : isMyHand ? 'rgba(236,72,153,0.45)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isActive ? '0 0 20px rgba(251,191,36,0.22)' : isMyHand ? '0 0 18px rgba(236,72,153,0.18)' : 'none',
        backdropFilter: 'blur(12px)',
      }}
    >
      {isDone && hand.result && hand.result !== 'pending' && <ResultBanner result={hand.result} />}

      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {isMyHand && <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />}
          <span className="text-xs font-semibold text-gray-300 truncate max-w-[90px]">{hand.display_name}</span>
          {hand.is_split_child && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400">Split</span>}
          {hand.doubled && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400">2×</span>}
        </div>
        <div className="flex items-center gap-2">
          <ChipStack amount={hand.bet} currency={hand.currency} animated={isActive || isMyHand} />
          <div className="text-right">
            <div className="text-yellow-400 font-black text-xs md:text-sm">{hand.bet}</div>
            <div className="text-[10px] text-gray-500">{hand.currency}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap justify-center items-center min-h-[78px] mb-3">
        {hand.cards?.length > 0 ? hand.cards.map((card, i) => <CardDisplay key={i} card={card} delay={i * 0.12} fromShoe />) : <div className="text-xs text-gray-600">Waiting…</div>}
      </div>

      <div className="flex justify-center mb-3">
        <ScoreBadge score={score} status={hand.status} />
      </div>

      {isMyHand && isActive && hand.status === 'active' && (
        <div className="space-y-2">
          {canInsure && (
            <Button onClick={onInsurance} size="sm" className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold">
              Insurance ({(hand.bet / 2).toFixed(0)})
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={onHit} size="sm" className="bg-emerald-600 hover:bg-emerald-700 font-black">Hit</Button>
            <Button onClick={onStand} size="sm" className="bg-slate-600 hover:bg-slate-700 font-black">Stand</Button>
            {hand.cards.length === 2 && <Button onClick={onDouble} size="sm" className="bg-violet-600 hover:bg-violet-700 font-black">Double</Button>}
            {canSplit && <Button onClick={onSplit} size="sm" className="bg-orange-600 hover:bg-orange-700 font-black">Split</Button>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlayMultiplayerBlackjack() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const TABLE_ID = searchParams.get('table');

  const [user, setUser] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [betAmount, setBetAmount] = useState(10);
  const [activeChip, setActiveChip] = useState(5);
  const [currency, setCurrency] = useState('IC');
  const [loading, setLoading] = useState(false);
  const [myHandIds, setMyHandIds] = useState([]);
  const [dealerShowsAce, setDealerShowsAce] = useState(false);
  const [insuranceOpen, setInsuranceOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      if (!u) navigate('/');
    }).catch(() => navigate('/'));
  }, []);

  const { data: table } = useQuery({
    queryKey: ['bj-table', TABLE_ID],
    queryFn: () => base44.entities.BlackjackTable.filter({ id: TABLE_ID }).then((r) => r[0]),
    enabled: !!TABLE_ID,
    refetchInterval: 2000,
  });

  const { data: round } = useQuery({
    queryKey: ['bj-round', table?.current_round_id],
    queryFn: () => base44.entities.BlackjackRound.filter({ id: table.current_round_id }).then((r) => r[0]),
    enabled: !!table?.current_round_id,
    refetchInterval: 1500,
  });

  const { data: wallet } = useQuery({
    queryKey: ['wallet', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user.email }).then((r) => r[0]),
    enabled: !!user?.email,
    refetchInterval: 3000,
  });

  const call = async (action, extra = {}) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('blackjackAction', { action, table_id: TABLE_ID, ...extra });
      queryClient.invalidateQueries({ queryKey: ['bj-table', TABLE_ID] });
      queryClient.invalidateQueries({ queryKey: ['bj-round', table?.current_round_id] });
      queryClient.invalidateQueries({ queryKey: ['wallet', user?.email] });
      return res.data;
    } catch (e) {
      toast.error(e.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const placeBet = async (seatOverride, amountOverride) => {
    const targetSeat = seatOverride || selectedSeat;
    const targetBet = amountOverride || betAmount;
    if (!targetSeat) return toast.error('Pick a seat first');
    const balance = currency === 'IC' ? wallet?.tokens : wallet?.cat_dollars;
    if (targetBet > balance) return toast.error('Insufficient balance');
    if (table?.max_bet && targetBet > table.max_bet) return toast.error(`Max bet is ${table.max_bet}`);
    if (table?.min_bet > 0 && targetBet < table.min_bet) return toast.error(`Min bet is ${table.min_bet}`);
    const res = await call('place_bet', { seat: targetSeat, bet: targetBet, currency });
    if (res?.hand_id) {
      setMyHandIds((prev) => [...prev, res.hand_id]);
      toast.success('Bet placed');
    }
  };

  const deal = async () => {
    const res = await call('deal');
    if (res?.dealer_shows_ace) {
      setDealerShowsAce(true);
      setInsuranceOpen(true);
      setTimeout(() => setInsuranceOpen(false), 15000);
    }
  };

  useEffect(() => {
    if (round?.status === 'dealer_turn' && !loading) {
      setTimeout(() => call('dealer_turn'), 800);
    }
  }, [round?.status]);

  useEffect(() => {
    if (round?.status === 'complete' || !round) {
      setMyHandIds([]);
      setDealerShowsAce(false);
      setInsuranceOpen(false);
    }
  }, [round?.status]);

  const myOccupiedSeat = (table?.seated_players || []).find((p) => p.user_email === user?.email)?.seat;

  useEffect(() => {
    if (myOccupiedSeat && !selectedSeat) setSelectedSeat(myOccupiedSeat);
  }, [myOccupiedSeat, selectedSeat]);

  if (!TABLE_ID) {
    navigate('/BlackjackLobby');
    return null;
  }

  const occupiedSeats = (table?.seated_players || []).map((p) => p.seat);
  const seats = Array.from({ length: 7 }, (_, i) => i + 1);
  const balance = currency === 'IC' ? wallet?.tokens || 0 : wallet?.cat_dollars || 0;
  const dealerScore = round?.dealer_cards?.length > 0 ? (round.status !== 'playing' ? calcScore(round.dealer_cards) : calcScore([round.dealer_cards[0]])) : 0;
  const roundComplete = round?.status === 'complete';
  const isBetting = !round || round.status === 'betting' || round.status === 'complete';
  const canDeal = round?.status === 'betting' && round?.hands?.length > 0;
  const chipValues = table?.is_high_roller ? [5, 25, 100] : [0.1, 0.25, 1, 5, 10, 25, 100];

  return (
    <div className="min-h-screen text-white overflow-hidden" style={{ background: '#0A0612' }}>
      <div className="relative min-h-screen">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-8 left-1/2 -translate-x-1/2 w-[32rem] h-[12rem] rounded-full bg-pink-500/10 blur-3xl" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[44rem] h-[22rem] rounded-full bg-fuchsia-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 px-4 md:px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-black/20">
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => navigate('/BlackjackLobby')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-medium text-sm md:text-base">
              <ArrowLeft className="w-5 h-5" /> Lobby
            </button>

            <div className="flex items-center gap-2 min-w-0">
              {table?.is_high_roller && <Crown className="w-4 h-4 md:w-5 md:h-5 text-yellow-400" />}
              <div className="truncate text-center">
                <div className="font-black tracking-wide truncate">{table?.name || 'Blackjack'}</div>
                <div className="flex items-center justify-center gap-1 text-[11px] text-gray-500">
                  <Users className="w-3 h-3" />
                  <span>{(table?.seated_players || []).length}/{table?.max_seats || 7}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrency((c) => (c === 'IC' ? 'ID' : 'IC'))}
                className="text-xs px-3 py-1.5 rounded-full font-bold"
                style={{
                  background: currency === 'IC' ? 'rgba(236,72,153,0.18)' : 'rgba(251,191,36,0.18)',
                  border: `1px solid ${currency === 'IC' ? 'rgba(236,72,153,0.55)' : 'rgba(251,191,36,0.55)'}`,
                  color: currency === 'IC' ? '#ec4899' : '#fbbf24',
                }}
              >
                {currency}
              </button>
              <div className="text-right">
                <div className="text-yellow-400 font-black text-sm md:text-base">{balance.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 px-3 md:px-6 py-4 md:py-6">
          <div className="relative mx-auto max-w-7xl min-h-[calc(100vh-110px)] rounded-[2rem] overflow-hidden border border-pink-500/10" style={{ background: 'radial-gradient(ellipse at center, rgba(74,29,120,0.96) 0%, rgba(40,14,66,0.98) 52%, #0A0612 100%)' }}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[82%] h-[58%] rounded-[50%] border border-pink-500/25 shadow-[0_0_45px_rgba(236,72,153,0.28)]" />
              <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[76%] h-[53%] rounded-[50%] border border-pink-400/20" />
              <div className="absolute top-[40%] left-1/2 -translate-x-1/2 text-pink-400/20 text-4xl md:text-6xl font-black tracking-[0.45em]">IMPERIAL</div>
              <TableSeatLayer seats={seats} seatedPlayers={table?.seated_players || []} selectedSeat={selectedSeat} currentUserEmail={user?.email} onSelectSeat={setSelectedSeat} />
              <TableBetSpots
                seats={seats}
                seatedPlayers={table?.seated_players || []}
                roundHands={round?.hands || []}
                selectedSeat={selectedSeat}
                activeChip={activeChip}
                onBetSpotClick={(seat) => {
                  setSelectedSeat(seat);
                  setBetAmount(activeChip);
                  placeBet(seat, activeChip);
                }}
              />
            </div>

            <div className="relative z-10 flex flex-col min-h-[calc(100vh-110px)] px-3 md:px-8 py-5 md:py-8 gap-6">
              <div className="flex flex-col items-center pt-6 md:pt-10">
                <div className="relative flex flex-col items-center mb-3">
                  <div className="absolute right-[12%] top-6 hidden lg:block">
                    <motion.div
                      animate={round?.status === 'dealing' ? { x: [0, -8, 0] } : { x: 0 }}
                      transition={{ duration: 0.5, repeat: round?.status === 'dealing' ? Infinity : 0 }}
                      className="w-12 h-16 rounded-lg"
                      style={{
                        background: 'linear-gradient(135deg, #24112f 0%, #120916 100%)',
                        border: '1px solid rgba(236,72,153,0.32)',
                        boxShadow: '0 0 18px rgba(236,72,153,0.16)'
                      }}
                    />
                  </div>
                  <DealerAvatar isActing={round?.status === 'dealer_turn'} isDealing={round?.status === 'dealing'} />
                  <div className="flex gap-2 md:gap-3 justify-center flex-wrap min-h-[110px] md:min-h-[132px] items-end mt-3">
                    {round?.dealer_cards?.length > 0 ? (
                      round.dealer_cards.map((card, i) => (
                        <CardDisplay key={i} card={card} large faceDown={i === 1 && round.status === 'playing'} delay={i * 0.18} fromShoe />
                      ))
                    ) : (
                      <div className="flex gap-2 md:gap-3 justify-center flex-wrap min-h-[110px] md:min-h-[132px] items-end mt-3">
                        {[0, 1].map((i) => (
                          <CardDisplay key={i} large placeholder />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {dealerScore > 0 && <ScoreBadge score={dealerScore} status={round?.status === 'complete' && dealerScore > 21 ? 'bust' : null} />}

                {round?.status === 'dealer_turn' && (
                  <motion.div animate={{ opacity: [1, 0.45, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="mt-3 text-pink-300 font-bold text-sm">
                    Dealer is playing...
                  </motion.div>
                )}
              </div>

              <div className="flex items-center gap-4 px-2 md:px-8">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-pink-500/25 to-transparent" />
                <div className="text-[11px] tracking-[0.3em] text-pink-300/50 font-black">PLAYERS</div>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-pink-500/25 to-transparent" />
              </div>

              {round?.hands?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                  {round.hands.map((hand) => (
                    <PlayerHand
                      key={hand.hand_id}
                      hand={hand}
                      isMyHand={myHandIds.includes(hand.hand_id)}
                      isActive={hand.hand_id === round.action_on_hand}
                      dealerShowsAce={dealerShowsAce}
                      insuranceOpen={insuranceOpen}
                      onHit={() => call('hit', { hand_id: hand.hand_id })}
                      onStand={() => call('stand', { hand_id: hand.hand_id })}
                      onDouble={() => call('double', { hand_id: hand.hand_id })}
                      onInsurance={() => call('insurance', { hand_id: hand.hand_id })}
                      onSplit={async () => {
                        const res = await call('split', { hand_id: hand.hand_id });
                        if (res?.new_hand_id) setMyHandIds((prev) => [...prev, res.new_hand_id]);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-600 text-sm py-6">{isBetting ? 'Tap a stool, then tap or drag-style choose a chip and drop it on your bet circle.' : 'Waiting for players...'}</div>
              )}

              {isBetting && (
                <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mt-auto flex justify-center">
                  <div className="w-full max-w-xl flex flex-col items-center gap-3">
                    <div className="text-center">
                      <p className="text-pink-200 text-xs font-black tracking-[0.3em] uppercase">Chip Rail</p>
                      <p className="text-gray-500 text-xs mt-1">Tap a stool, then tap a chip and drop it on the bet circle.</p>
                    </div>
                    <ChipRail chips={chipValues} activeChip={activeChip} onTapChip={(chip) => { setActiveChip(chip); setBetAmount(chip); }} />
                    {table?.min_bet > 0 && <p className="text-gray-600 text-xs">Min: {table.min_bet} · Max: {table.max_bet} {table.currency === 'both' ? 'IC/ID' : table.currency}</p>}
                  </div>
                </motion.div>
              )}

              <div className="flex gap-3 pb-1">
                {canDeal && (
                  <motion.div className="flex-1" whileTap={{ scale: 0.98 }}>
                    <Button onClick={deal} disabled={loading} className="w-full h-12 md:h-14 text-base md:text-lg font-black" style={{ background: 'linear-gradient(135deg, #ec4899, #be185d)', boxShadow: '0 0 24px rgba(236,72,153,0.38)' }}>
                      Deal Cards
                    </Button>
                  </motion.div>
                )}
                {roundComplete && (
                  <motion.div className="flex-1" whileTap={{ scale: 0.98 }}>
                    <Button onClick={() => { setMyHandIds([]); queryClient.invalidateQueries(); }} className="w-full h-12 md:h-14 text-base md:text-lg font-black bg-white/10 hover:bg-white/15 border border-pink-500/20">
                      New Round
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}