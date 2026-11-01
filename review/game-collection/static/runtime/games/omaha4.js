import * as poker from './poker-core.js';
export function create(seed=1){return poker.create(seed,4,'omaha');}
export const apply=poker.apply,bot=poker.bot;
