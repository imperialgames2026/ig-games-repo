import * as casino from './casino-core.js';
import {rouletteBetsApply} from './roulette-bets.js';
export function create(seed=1){return {...casino.create(seed,'roulette'),balanceCents:1000000,bets:{},placements:[]};}
export const apply=rouletteBetsApply;
export function bot(s){return Object.keys(s.bets||{}).length?{type:'spinBets'}:{type:'placeChip',spot:'red',cents:100};}
