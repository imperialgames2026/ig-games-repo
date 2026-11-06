import * as rummy from "./rummy.js";
export function create(seed=1){return rummy.create(seed,6);}
export const apply=rummy.apply,bot=rummy.bot;
