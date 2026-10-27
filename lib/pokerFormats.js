export const HOLDEM_CAPACITIES=Object.freeze([2,4,6,8,9]);
export const POKER_FORMATS=Object.freeze(HOLDEM_CAPACITIES.map(capacity=>Object.freeze({capacity,label:capacity===2?'Heads up':`${capacity}-seat table`,model:`/poker-tables/NLHE_${capacity}.glb`,preview:`/poker-tables/NLHE_${capacity}.png`})));
export function validPokerCapacity(variant,capacity){return Number.isInteger(capacity)&&(variant==='omaha'?capacity===6:variant==='holdem'&&HOLDEM_CAPACITIES.includes(capacity));}
// Missing metadata retains the established pre-capacity Holdem8/Omaha6 format only.
// New selected formats require the capacity RPC; unknown explicit values never normalize.
export function pokerCapacity(table,variant='holdem'){const capacity=table?.seatCapacity??(variant==='omaha'?6:8);return validPokerCapacity(variant,capacity)?capacity:null;}
