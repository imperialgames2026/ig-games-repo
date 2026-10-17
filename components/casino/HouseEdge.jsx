/**
 * House Edge Calculator
 * Adjusts win probability based on bet size relative to balance
 * Higher bets = lower win chance (house favored)
 * Lower bets = higher win chance (player friendly)
 */

export function calculateWinProbability(betAmount, balance, baseWinChance = 0.48) {
  if (!balance || balance <= 0) return baseWinChance;
  
  // Calculate bet percentage of balance (0 to 1)
  const betPercentage = Math.min(betAmount / balance, 1);
  
  // Apply sliding scale:
  // - Low bets (< 5% of balance): +10% bonus to win chance
  // - Medium bets (5-20%): neutral
  // - High bets (> 20%): -15% penalty to win chance
  
  let adjustedChance = baseWinChance;
  
  if (betPercentage < 0.05) {
    // Small bets get bonus
    const bonus = (0.05 - betPercentage) * 2; // up to +10%
    adjustedChance = Math.min(baseWinChance + bonus, 0.65);
  } else if (betPercentage > 0.2) {
    // Large bets get penalty
    const penalty = (betPercentage - 0.2) * 0.375; // up to -30% at 100%
    adjustedChance = Math.max(baseWinChance - penalty, 0.25);
  }
  
  return adjustedChance;
}

/**
 * Determines if player wins based on adjusted probability
 */
export function shouldPlayerWin(betAmount, balance, baseWinChance = 0.48) {
  const winProbability = calculateWinProbability(betAmount, balance, baseWinChance);
  return Math.random() < winProbability;
}

/**
 * Calculate house edge percentage for display
 */
export function getHouseEdge(betAmount, balance, baseWinChance = 0.48) {
  const winChance = calculateWinProbability(betAmount, balance, baseWinChance);
  return ((1 - winChance) * 100).toFixed(1);
}