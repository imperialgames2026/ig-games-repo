// Pure shared rules for visual craps chip placement. The database is the only authority
// that can accept a bet or move nonredeemable practice chips.
export const CRAPS_WAGER_TARGETS = new Set([
  'pass','dont_pass','field','any_seven','place_4','place_5','place_6','place_8','place_9','place_10',
]);
export function validCrapsDropTarget(target,point){
  return CRAPS_WAGER_TARGETS.has(target) &&
    !(point != null && (target==='pass'||target==='dont_pass'));
}
export function canDropCrapsChip({enabled,blocked,amount,available,target,point}){
  return Boolean(enabled) && !blocked &&
    Number.isInteger(amount) && amount>=1 && amount<=100 &&
    Number.isFinite(available) && available>=amount &&
    validCrapsDropTarget(target,point);
}
