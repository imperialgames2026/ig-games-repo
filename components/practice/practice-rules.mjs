import { validAmount, validSelection } from "./bet-layout.mjs";
import { reds, passLine, validateOutcome } from "./outcomes.mjs";
export function settlePractice({
  outcome,
  selected,
  point = 0,
  stake
}) {
  if (!validateOutcome(outcome) || !validAmount(stake)) throw new Error("Invalid practice round");
  if (outcome.game === "craps") {
    if (![0, 4, 5, 6, 8, 9, 10].includes(point)) throw new Error("Invalid point");
    const total = outcome.values[0] + outcome.values[1],
      next = passLine(point, total);
    return {
      ...next,
      credit: next.result === "win" ? stake * 2 : 0,
      label: `Rolled ${total} · ${next.result === "point" ? `Point is ${next.point}` : next.result === "roll" ? `Point ${next.point} stays` : next.result === "win" ? "Pass line wins" : "Pass line loses"}`
    };
  }
  if (!(Number.isInteger(selected) && selected >= 0 && selected <= 36) && !["red", "black", "even", "odd"].includes(selected)) throw new Error("Invalid roulette selection");
  const n = outcome.values[0];
  const win = typeof selected === "number" ? n === selected : selected === "red" ? reds.has(n) : selected === "black" ? n !== 0 && !reds.has(n) : selected === "even" ? n !== 0 && n % 2 === 0 : n % 2 === 1;
  return {
    point: 0,
    result: win ? "win" : "lose",
    credit: win ? stake * (typeof selected === "number" ? 36 : 2) : 0,
    label: `${n} ${n === 0 ? "green" : reds.has(n) ? "red" : "black"} · ${win ? "Win" : "No win"}`
  };
}
export const initialTableState = {
  game: 'roulette',
  chips: 1000,
  bets: {},
  point: 0,
  funded: true,
  undo: []
};
const sum = b => Object.values(b).reduce((a, n) => a + n, 0);
function reserve(state, bets, undo) {
  const wallet = state.chips + (state.funded ? sum(state.bets) : 0),
    total = sum(bets),
    funded = wallet >= total;
  return {
    ...state,
    bets,
    undo,
    funded,
    chips: wallet - (funded ? total : 0)
  };
}
export function tableReducer(state, action) {
  if (action.type === 'place') {
    if (state.point || !validSelection(state.game, action.selection) || !validAmount(action.amount)) return state;
    const bets = {
      ...state.bets,
      [action.selection]: (state.bets[action.selection] || 0) + action.amount
    };
    if (!validAmount(bets[action.selection])) return state;
    const next = reserve(state, bets, [...state.undo, {
      selection: action.selection,
      amount: action.amount
    }]);
    return next.funded ? next : state;
  }
  if (action.type === 'clear' && !state.point) return reserve(state, {}, []);
  if (action.type === 'undo' && !state.point && state.undo.length) {
    const last = state.undo.at(-1),
      bets = {
        ...state.bets
      };
    bets[last.selection] -= last.amount;
    if (bets[last.selection] === 0) delete bets[last.selection];
    return reserve(state, bets, state.undo.slice(0, -1));
  }
  if (action.type === 'game' && !state.point && !Object.keys(state.bets).length && ['roulette', 'craps'].includes(action.game)) return {
    ...state,
    game: action.game
  };
  if (action.type === 'reset' && !state.point && !Object.keys(state.bets).length) return {
    ...state,
    chips: 1000
  };
  if (action.type === 'settle') {
    if (!state.funded || !Object.keys(state.bets).length || action.outcome.game !== state.game) return state;
    let credit = 0,
      point = state.point,
      hold = false;
    for (const [selection, stake] of Object.entries(state.bets)) {
      const r = settlePractice({
        outcome: action.outcome,
        selected: /^\d+$/.test(selection) ? Number(selection) : selection,
        point: state.point,
        stake
      });
      credit += r.credit;
      point = r.point;
      hold = state.game === 'craps' && ['point', 'roll'].includes(r.result);
    }
    if (hold) return {
      ...state,
      point
    };
    // The just-finished stakes are consumed; reserve fresh chips for the repeat.
    const available = state.chips + credit,
      total = sum(state.bets),
      funded = available >= total;
    return {
      ...state,
      chips: available - (funded ? total : 0),
      point,
      funded
    };
  }
  return state;
}
