const shapes={
p:'<circle cx="22.5" cy="12" r="5.5"/><path d="M17 18h11l-2 9 6 7H13l6-7z"/><path d="M12 35h21v5H12z"/>',
r:'<path d="M11 6h6v6h4V6h4v6h4V6h6v12l-5 4 1 12H14l1-12-4-4z"/><path d="M11 35h23v5H11zM15 18h15M17 24h11"/>',
n:'<path d="M11 35c1-9 5-12 14-16l-9 1-4 5-5-4 7-12 5-1 1-5 7 5c10 5 10 17 8 27z"/><path d="M10 36h26v4H10z"/><circle cx="20" cy="13" r="1" fill="currentColor"/>',
b:'<path d="M22.5 4c-5 4-10 10-10 15 0 4 5 7 8 8l-6 7h17l-6-7c3-1 8-4 8-8 0-5-5-11-10.5-15z"/><path d="m25 11-6 9M12 35h21v5H12z"/>',
q:'<path d="m9 13 5 19h17l5-19-9 10-4.5-15L18 23z"/><circle cx="8" cy="10" r="3"/><circle cx="22.5" cy="5" r="3"/><circle cx="37" cy="10" r="3"/><path d="M12 35h21v5H12zM14 31h17"/>',
k:'<path d="M22.5 3v10M18 7h9" fill="none"/><path d="M22.5 14c-5-8-17-2-12 7l6 11h13l6-11c5-9-7-15-12.5-7z"/><path d="M12 35h21v5H12zM16 29h13"/>'};
export function pieceSvg(type,color){const white=color==='w';return `<svg class="piece" viewBox="0 0 45 45" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" style="color:${white?'#4f4a3c':'#ceb98b'}" fill="${white?'#f6efda':'#23372a'}" stroke="${white?'#615a45':'#c9b588'}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">${shapes[type]}</svg>`;}
export const pieceNames={p:'pawn',r:'rook',n:'knight',b:'bishop',q:'queen',k:'king'};
