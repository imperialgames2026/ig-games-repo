import * as casino from './casino-core.js';
export function create(seed=1){return casino.create(seed,'blackjack');}
export const apply=casino.blackjackApply,bot=casino.bot;
