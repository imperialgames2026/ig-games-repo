import * as poker from './poker-core.js';
export function create(seed=1){return poker.create(seed,7);}
export const apply=poker.apply,bot=poker.bot;
