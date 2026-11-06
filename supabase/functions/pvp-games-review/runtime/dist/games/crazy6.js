import * as poker from './poker-core.js';
export function create(seed=1){return poker.create(seed,6,'crazy_pineapple');}
export const apply=poker.apply,bot=poker.bot;
