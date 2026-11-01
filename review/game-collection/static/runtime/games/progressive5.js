import * as poker from './poker-core.js';
export function create(seed=1){return poker.create(seed,6,'progressive_draw');}
export const apply=poker.apply,bot=poker.bot;
