import * as casino from './casino-core.js';
export function create(seed=1){return casino.create(seed,'craps');}
export const apply=casino.crapsApply,bot=casino.bot;
