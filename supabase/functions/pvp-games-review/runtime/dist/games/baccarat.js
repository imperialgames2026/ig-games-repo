import * as casino from './casino-core.js';
export function create(seed=1){return casino.create(seed,'baccarat');}
export const apply=casino.baccaratApply,bot=casino.bot;
