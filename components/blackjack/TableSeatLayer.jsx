import React from 'react';
import BlackjackStoolSeat from './BlackjackStoolSeat';

function getSeatPositions(count) {
  const start = 205;
  const end = 335;
  const spread = end - start;
  return Array.from({ length: count }, (_, i) => {
    const angle = count === 1 ? 270 : start + (spread / (count - 1)) * i;
    const rad = (angle * Math.PI) / 180;
    return { x: Math.cos(rad), y: Math.sin(rad) };
  });
}

export default function TableSeatLayer({ seats, seatedPlayers, selectedSeat, currentUserEmail, onSelectSeat }) {
  const positions = getSeatPositions(seats.length);

  return (
    <>
      {seats.map((seat, i) => {
        const pos = positions[i];
        const x = 50 + pos.x * 41;
        const y = 67 + pos.y * 25;
        const occupant = seatedPlayers.find((p) => p.seat === seat);
        const selected = selectedSeat === seat;
        const occupiedByMe = occupant?.user_email === currentUserEmail;
        const occupied = !!occupant && !occupiedByMe;

        return (
          <div
            key={seat}
            className="absolute z-20"
            style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
          >
            <BlackjackStoolSeat
              seat={seat}
              occupied={occupied}
              selected={selected || occupiedByMe}
              label={occupant?.display_name || ''}
              onClick={() => !occupied && onSelectSeat(seat)}
            />
          </div>
        );
      })}
    </>
  );
}