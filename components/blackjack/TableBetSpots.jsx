import React from 'react';
import ChipStack from './ChipStack';

function getSpotPositions(count) {
  const start = 205;
  const end = 335;
  const spread = end - start;
  return Array.from({ length: count }, (_, i) => {
    const angle = count === 1 ? 270 : start + (spread / (count - 1)) * i;
    const rad = (angle * Math.PI) / 180;
    return { x: Math.cos(rad), y: Math.sin(rad) };
  });
}

export default function TableBetSpots({ seats, seatedPlayers, roundHands, selectedSeat, activeChip, onBetSpotClick }) {
  const positions = getSpotPositions(seats.length);

  return (
    <>
      {seats.map((seat, i) => {
        const pos = positions[i];
        const x = 50 + pos.x * 25;
        const y = 52 + pos.y * 14;
        const occupant = seatedPlayers.find((p) => p.seat === seat);
        const hand = roundHands.find((h) => h.seat === seat);
        const showSelectable = selectedSeat === seat && !hand;

        return (
          <div key={seat} className="absolute z-10" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="flex flex-col items-center gap-1">
                  <div className="text-[9px] md:text-[10px] font-black tracking-[0.18em] text-red-300/80">INS</div>
                  <div
                    className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(127,29,29,0.22)',
                      border: '2px solid rgba(248,113,113,0.75)',
                      boxShadow: '0 0 10px rgba(239,68,68,0.18)'
                    }}
                  >
                    {occupant && hand?.insurance_bet ? <div className="text-[10px] font-black text-red-200">IN</div> : null}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="text-[10px] md:text-[11px] font-black tracking-[0.18em] text-white/75">BET</div>
                  <button
                    onClick={() => showSelectable && onBetSpotClick(seat)}
                    className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: `2px solid ${showSelectable ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.3)'}`,
                      boxShadow: showSelectable ? '0 0 22px rgba(255,255,255,0.12)' : 'none'
                    }}
                  >
                    {hand ? <ChipStack amount={hand.bet} currency={hand.currency} animated /> : activeChip && showSelectable ? <div className="text-[10px] font-black text-white/80">+{activeChip}</div> : null}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}