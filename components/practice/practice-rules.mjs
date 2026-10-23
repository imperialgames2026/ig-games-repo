import { reds, passLine, validateOutcome } from "./outcomes.mjs";
export function settlePractice({ outcome, selected, point = 0, stake }) {
  if (!validateOutcome(outcome) || ![10, 25, 50].includes(stake))
    throw new Error("Invalid practice round");
  if (outcome.game === "craps") {
    if (![0, 4, 5, 6, 8, 9, 10].includes(point))
      throw new Error("Invalid point");
    const total = outcome.values[0] + outcome.values[1],
      next = passLine(point, total);
    return {
      ...next,
      credit: next.result === "win" ? stake * 2 : 0,
      label: `Rolled ${total} · ${next.result === "point" ? `Point is ${next.point}` : next.result === "roll" ? `Point ${next.point} stays` : next.result === "win" ? "Pass line wins" : "Pass line loses"}`,
    };
  }
  if (
    !(Number.isInteger(selected) && selected >= 0 && selected <= 36) &&
    !["red", "black", "even", "odd"].includes(selected)
  )
    throw new Error("Invalid roulette selection");
  const n = outcome.values[0];
  const win =
    typeof selected === "number"
      ? n === selected
      : selected === "red"
        ? reds.has(n)
        : selected === "black"
          ? n !== 0 && !reds.has(n)
          : selected === "even"
            ? n !== 0 && n % 2 === 0
            : n % 2 === 1;
  return {
    point: 0,
    result: win ? "win" : "lose",
    credit: win ? stake * (typeof selected === "number" ? 36 : 2) : 0,
    label: `${n} ${n === 0 ? "green" : reds.has(n) ? "red" : "black"} · ${win ? "Win" : "No win"}`,
  };
}
