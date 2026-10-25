// Published routes with reviewed practice backends. Keep financial games gated.
export const approvedPracticeGames = [
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
