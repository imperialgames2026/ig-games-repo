// Published routes with reviewed practice backends. Keep financial games gated.
export const approvedPracticeGames = [
 {slug:'darts',name:'Darts',route:'/PlayDarts',backend:'ig-final-practice',category:'instant',icon:'🎯',description:'Server-owned weighted dart zones with a reproducible round proof.'},
 {slug:'dice-zone',name:'Dice Zone',route:'/PlayDiceZone',backend:'ig-final-practice',category:'instant',icon:'🎲',description:'Choose an inclusive zone from 1 to 100 and verify the committed roll.'},
 {slug:'hilo',name:'HiLo',route:'/PlayHiLo',backend:'ig-final-practice',category:'cards',icon:'🃏',description:'Predict the next card, keep future cards hidden and verify the completed transcript.'},
 {slug:'towers',name:'Towers',route:'/PlayTowers',backend:'ig-final-practice',category:'instant',icon:'🏰',description:'Climb nine hidden floors using server-owned moves, then reveal and verify the board.'},
 {slug:'rocket',name:'Rocket',route:'/PlayRocket',backend:'ig-crash-v2',category:'instant',icon:'🚀',description:'Rocket entry to the shared server-timed Crash practice flight.'},
 {slug:'dice',name:'Practice Dice',route:'/PlayDice',backend:'provably-fair-v2',category:'instant',icon:'🎲',description:'Two dice with a server commitment and a reproducible fairness proof.'},
 {slug:'coin-flip',name:'Coin Flip',route:'/PlayCoinFlip',backend:'ig-originals-practice',category:'instant',icon:'🪙',description:'Choose heads or tails and verify the revealed server outcome.'},
 {slug:'hashdice',name:'Hash Dice',route:'/PlayHashDice',backend:'ig-originals-practice',category:'instant',icon:'🎲',description:'Choose high or low and verify the HMAC-derived result on your device.'},
 {slug:'limbo',name:'Limbo',route:'/PlayLimbo',backend:'ig-originals-practice',category:'instant',icon:'🚀',description:'Set a target and reveal a reproducible practice multiplier.'},
 {slug:'plinko',name:'Plinko',route:'/PlayPlinko',backend:'ig-originals-practice',category:'instant',icon:'🔻',description:'Follow twelve independently derived steps and verify the final position.'},
 {slug:'wheel',name:'Wheel',route:'/PlayWheel',backend:'ig-originals-practice',category:'instant',icon:'🎡',description:'Choose a color and verify the committed twenty-slot wheel result.'},
 {slug:'mines',name:'Mines',route:'/PlayMines',backend:'ig-mines-practice',category:'instant',icon:'💎',description:'Pick tiles on a hidden server-owned board, then stop and verify its proof.'},
 {slug:'poker',name:'Texas Hold’em Poker',route:'/PlayPoker',backend:'poker-table-v1',category:'cards',description:'Shared practice tables with private hole cards and server-controlled hands.'},
 {slug:'omaha',name:'Omaha Poker',route:'/PlayOmaha',backend:'poker-table-v1',category:'cards',description:'Four-card Omaha using exactly two hole cards and three community cards.'},
 {slug:'blackjack',name:'Multiplayer Blackjack',route:'/PlayBlackjack',backend:'ig-blackjack-practice',category:'cards',description:'Shared seats and a server-controlled dealer using imaginary chips.'},
 {slug:'baccarat',name:'Multiplayer Baccarat',route:'/PlayBaccarat',backend:'ig-shared-event-practice',category:'table',description:'One shared eight-deck hand with server-controlled third-card rules.'},
 {slug:'craps',name:'Multiplayer Craps',route:'/PlayCraps',backend:'ig-multiplayer-practice',category:'table',description:'Shared server dice with shooter turns and imaginary practice bets.'},
 {slug:'roulette',name:'Multiplayer Roulette',route:'/PlayRoulette',backend:'ig-multiplayer-practice',category:'table',description:'A shared single-zero wheel with server-owned practice results.'},
 {slug:'crash',name:'Multiplayer Crash',route:'/PlayCrash',backend:'ig-crash-v2',category:'instant',description:'A server-timed shared multiplier and automatic practice cashout.'},
 {slug:'trenball',name:'Multiplayer Trenball',route:'/PlayTrenball',backend:'ig-crash-v2',category:'instant',description:'Color predictions on the shared server-timed Crash round.'},
];

export function approvedCatalogRoute(game) {
 if (game?.practice_only !== true || game.real_wagers_enabled !== false || game.game_type !== 'internal') return null;
 return approvedPracticeGames.find(item => item.slug === game.slug && item.route === game.route)?.route || null;
}
