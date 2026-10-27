// Public verification only. Salts for unrevealed cards and the shuffle seed
// never enter this module. Hashes bind cards to a table, hand and deck position.
const hex64 = /^[a-f0-9]{64}$/;
const encoder = new TextEncoder();
export async function hashText(text) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
export async function verifyDealProof(proof) {
  if (!proof || !['holdem','omaha'].includes(proof.variant) || proof.algorithm !== 'poker-deck-v1' || !Array.isArray(proof.cardHashes) ||
      proof.cardHashes.length !== 52 || !proof.cardHashes.every(h => typeof h === 'string' && hex64.test(h)) ||
      !Number.isSafeInteger(proof.handNo) || proof.handNo < 1 || !hex64.test(proof.root)) throw Error('Invalid locked-deck proof');
  if (!Array.isArray(proof.dealAssignments) || proof.dealAssignments.length < 2 || proof.dealAssignments.length > (proof.variant === 'omaha' ? 6 : 9) ||
      !Array.isArray(proof.boardPositions) || proof.boardPositions.length !== 5 || typeof proof.dealLayout !== 'string') throw Error('Invalid deal layout');
  const slots = [...proof.boardPositions];
  const seats = new Set();
  for (const assignment of proof.dealAssignments) {
    if (!Number.isInteger(assignment.seatNo) || assignment.seatNo < 0 || assignment.seatNo >= (proof.variant === 'omaha' ? 6 : 9) || seats.has(assignment.seatNo) ||
        !Array.isArray(assignment.holePositions) || assignment.holePositions.length !== (proof.variant === 'omaha' ? 4 : 2)) throw Error('Invalid seat assignment');
    seats.add(assignment.seatNo); slots.push(...assignment.holePositions);
  }
  if (slots.some(p => !Number.isInteger(p) || p < 0 || p >= 52) || new Set(slots).size !== slots.length) throw Error('Duplicate deal position');
  const layoutParts = proof.dealLayout.split('|');
  const expectedLayout = `poker-layout-v1|${proof.dealAssignments[0].seatNo}|${proof.dealAssignments.map(a=>`${a.seatNo}:${a.holePositions.join(',')}`).join(';')}|${proof.boardPositions.join(',')}`;
  if (layoutParts.length !== 4 || proof.dealLayout !== expectedLayout ||
      JSON.stringify(proof.dealAssignments.find(a=>a.seatNo===proof.mySeat)?.holePositions) !== JSON.stringify(proof.myPositions)) throw Error('Deal assignment mismatch');
  const root = await hashText(`poker-deck-v1|${proof.tableId}|${proof.handNo}|${proof.cardHashes.join('')}|${proof.dealLayout}`);
  if (root !== proof.root) throw Error('Locked-deck commitment mismatch');
  const seen = new Set();
  for (const opening of proof.openings || []) {
    const { position, card, salt, hash } = opening;
    if (!Number.isSafeInteger(position) || position < 0 || position >= 52 || seen.has(position) ||
        !card || !Number.isInteger(card.rank) || card.rank < 2 || card.rank > 14 ||
        !['c','d','h','s'].includes(card.suit) || !hex64.test(salt)) throw Error('Invalid card opening');
    seen.add(position);
    const computed = await hashText(`poker-card-v1|${proof.tableId}|${proof.handNo}|${position}|${card.rank}|${card.suit}|${salt}`);
    if (computed !== hash || hash !== proof.cardHashes[position]) throw Error('Card differs from locked deal');
  }
  if (!proof.head || await hashText(`poker-step-v1|${proof.head.previousHash}|${proof.head.canonical}`) !== proof.head.hash) throw Error('Invalid ledger head');
  const head = JSON.parse(proof.head.canonical);
  if (head.tableId !== proof.tableId || head.handNo !== proof.handNo || head.step !== proof.lastStep) throw Error('Wrong ledger head');
  return true;
}
export function rememberDealRoot(proof, storage) {
  const key = `imperial-poker-deck-v1:${proof.tableId}:${proof.handNo}`;
  const previous = storage.getItem(key);
  if (previous && previous !== proof.root) throw Error('Server changed a previously observed deck commitment');
  if (!previous) storage.setItem(key, proof.root);
  const headKey = key + ':head';
  const stored = storage.getItem(headKey);
  const pinned = stored ? JSON.parse(stored) : null;
  const head = JSON.parse(proof.head.canonical);
  if (pinned) {
    const observed = (proof.steps || []).find(event => JSON.parse(event.canonical).step === pinned.step) ||
      (head.step === pinned.step ? proof.head : null);
    if (observed && observed.hash !== pinned.hash) throw Error('Server changed a previously observed hand ledger');
  }
  if (!pinned || head.step >= pinned.step) storage.setItem(headKey, JSON.stringify({ step: head.step, hash: proof.head.hash }));
  return Boolean(previous);
}
export async function verifyPokerSnapshot(snapshot) {
  if(!snapshot?.table||!['holdem','omaha'].includes(snapshot.table.variant))throw Error('Invalid poker snapshot');
  const proof=snapshot.deckProof;
  const capacity=snapshot.table.seatCapacity??(snapshot.table.variant==='omaha'?6:8);
  if(!Number.isInteger(capacity)||(snapshot.table.variant==='omaha'?capacity!==6:![2,4,6,8,9].includes(capacity))||!Array.isArray(snapshot.seats)||snapshot.seats.some(s=>!Number.isInteger(s.seat_no)||s.seat_no<0||s.seat_no>=capacity))throw Error('Invalid table capacity');
  await verifyDealProof(proof);
  if(proof.tableId!==snapshot.table.id || proof.handNo!==snapshot.table.handNo) throw Error('Wrong hand proof');
  const head=JSON.parse(proof.head.canonical);
  if(head.version!==snapshot.table.version) throw Error('Table changed while loading. Refreshing the hand…');
  const openings=new Map(proof.openings.map(o=>[o.position,o.card]));
  for(const [cards,positions] of [[snapshot.holeCards,proof.myPositions],[snapshot.table.board,proof.boardPositions.slice(0,head.board.length)]]){
    if(!Array.isArray(cards)||cards.length!==positions.length)throw Error('Visible cards differ from locked deal');
    cards.forEach((card,i)=>{
      const locked=openings.get(positions[i]);
      if(!locked||card.rank!==locked.rank||card.suit!==locked.suit)throw Error('Visible cards differ from locked deal');
    });
  }
  return true;
}
export async function verifyReplay(proof) {
  await verifyDealProof(proof);
  if (!proof.complete || !Array.isArray(proof.steps) || proof.steps.length !== proof.lastStep + 1 || !proof.steps.length)
    throw Error('Incomplete hand ledger');
  let previous = proof.root;
  const states = [];
  const openings = new Map(proof.openings.map(o => [o.position, o.card]));
  for (let i = 0; i < proof.steps.length; i++) {
    const event = proof.steps[i];
    if (event.previousHash !== previous || await hashText(`poker-step-v1|${previous}|${event.canonical}`) !== event.hash)
      throw Error('Hand ledger hash mismatch');
    const state = JSON.parse(event.canonical);
    if (state.tableId !== proof.tableId || state.handNo !== proof.handNo || state.step !== i ||
        (i && state.version <= states[i-1].version) || !Array.isArray(state.board) || state.board.length > 5)
      throw Error('Hand ledger sequence mismatch');
    for (let n = 0; n < state.board.length; n++) {
      const card = openings.get(proof.boardPositions[n]);
      if (!card || card.rank !== state.board[n].rank || card.suit !== state.board[n].suit)
        throw Error('Board differs from locked deal');
    }
    states.push(state); previous = event.hash;
  }
  if (states[0].kind !== 'deal' || states.at(-1).status !== 'complete' || proof.steps.at(-1).hash !== proof.head.hash) throw Error('Hand boundaries missing');
  return states;
}
