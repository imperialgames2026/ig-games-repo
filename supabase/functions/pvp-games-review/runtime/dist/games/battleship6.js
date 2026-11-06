import * as game from "./battleship.js";
export function create(seed = 1) { return game.create(seed, 6); }
export const apply = game.apply;
export const bot = game.bot;
