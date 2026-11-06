// Current reviewed table-game verification slice, not the scope of future skill
// games. Backend guards remain independent of this website availability policy.
export const activePracticeGameRoutes = [
  'PlayPoker', 'PlayOmaha', 'PlayBlackjack', 'PlayMultiplayerBlackjack',
  'PlayBaccarat', 'PlayCraps', 'PlayRoulette', 'PlayCrash', 'PlayTrenball',
];

export const parkedPracticeGameRoutes = [
  'PlayDarts', 'PlayDiceZone', 'PlayHiLo', 'PlayRocket', 'PlayTowers',
  'PlayDice', 'PlayCoinFlip', 'PlayHashDice', 'PlayLimbo', 'PlayPlinko',
  'PlayWheel', 'PlayMines',
];

export const disabledFinancialRoutes = new Set([
  'Payments', 'Withdraw', 'CryptoWallet', 'DepositNetworks', 'PrizeClaims',
]);
