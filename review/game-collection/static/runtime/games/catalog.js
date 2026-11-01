export const games = [
  {
    id: "chess",
    name: "Chess",
    icon: "♜",
    category: "Strategy",
    players: 2,
    tag: "Classic · complete rules",
    description: "Own the center. Think three moves ahead.",
    rules:
      "Standard chess: legal moves, castling, en passant, promotion, checkmate and draws. This local practice version automatically adjudicates threefold repetition and the 50-move rule. Untimed. White moves first.",
  },
  {
    id: "checkers",
    name: "Checkers",
    icon: "◉",
    category: "Strategy",
    players: 2,
    tag: "American · 8 × 8",
    description: "Force the jump. Crown your advantage.",
    rules:
      "American checkers. Red starts at the bottom. Men move and capture forward; kings move and capture in both directions. Captures and continuation jumps are compulsory. Crowning ends a jump turn. No flying kings. No legal move loses. Three repeated positions or 40 turns each without capture/promotion is a draw.",
  },
  {
    id: "dominoes",
    name: "Dominoes",
    icon: "⚄",
    category: "Tiles",
    players: 2,
    tag: "Draw · race to 100",
    description: "Read the ends. Close the table.",
    rules:
      "Heads-up double-six draw dominoes. Seven tiles per player. Highest dealt double opens; highest total tile opens if no doubles were dealt. Match either end. Draw until able to play; pass only with an empty boneyard. Going out scores the opponent’s remaining pips. A blocked round scores the difference in remaining pips for the lower hand. Tied blocked round scores zero. First to 100.",
  },
  {
    id: "euchre",
    name: "Euchre",
    icon: "♣",
    category: "Cards",
    players: 4,
    tag: "Partners · first to 10",
    description: "Call trump. Trust your partner. Go alone.",
    rules:
      "North American 24-card partnership Euchre. Seats 0 and 2 are partners. Right bower is highest; same-color left bower belongs to trump. Two bidding rounds, stick the dealer in round two. Dealer picks up the upcard in round one and discards. Caller may go alone; partner sits out. Follow effective suit. Makers score 1 for 3–4 tricks, 2 for a sweep, 4 for a lone sweep; defenders score 2 for a euchre. First to 10. No joker or defender loners.",
  },
  {
    id: "rummy",
    name: "Rummy",
    icon: "♦",
    category: "Cards",
    players: 2,
    tag: "Straight rummy · first to 100",
    description: "Build your runs. Leave nothing behind.",
    rules:
      "Two-player straight rummy, ten cards each, ace low. Draw stock or top discard. Optionally lay down one meld per turn: 3+ consecutive cards in one suit or 3–4 equal ranks. Lay off onto any existing meld. End by discarding; the discard you picked up cannot be returned that turn. Going out by melding, laying off or discarding ends the hand; score remaining opponent cards (ace 1, faces 10). House variant: stock exhaustion ends an unscored hand, no recycling. First to 100. This is straight rummy, not Gin or Rummy 500.",
  },
  {
    id: "hearts",
    name: "Hearts",
    icon: "♥",
    category: "Cards",
    players: 4,
    tag: "Four players · lowest score",
    description: "Keep your heart out of it. Unless you take them all.",
    rules:
      "Four-player American Hearts. Pass three left, right, across, then hold. Two of clubs opens. Follow suit. Hearts cannot be led before broken unless holding only hearts. No points on first trick when avoidable. Each heart is 1 penalty; queen of spades is 13. Shooting the moon adds 26 to each opponent. When anyone reaches 100, lowest score wins; equal lowest scores share the win.",
  },
  {
    id: "pinochle",
    name: "Pinochle",
    icon: "♠",
    category: "Cards",
    players: 4,
    tag: "Single deck · partnership auction",
    description: "Win the bid. Make your meld count.",
    rules:
      "48-card single-deck partnership Pinochle, two copies of 9 J Q K 10 A. Seats 0 and 2 partner. Auction starts at 25, increments of 1, no partner card exchange. If everyone passes dealer takes 25. Bid winner chooses trump and leads. Must follow suit and beat the current winning card when able; if void must trump and overtrump when able. First of equal cards wins. Compressed meld: run 15/150 double, marriages 2 or 4 trump, pinochle 4/30, aces around 10/100, kings 8/80, queens 6/60, jacks 4/40, trump nine 1. Runs consume their own marriage. A/10/K counters 1 each, last trick 1 (25 available). Team needs a trick to keep meld. Bid team must make meld+counters or loses its bid. First to 150; bidding team wins if both cross together.",
  },
  {
    id: "battleship",
    name: "Fleet Command · 5 ships",
    icon: "⚓",
    category: "Deduction",
    players: 2,
    tag: "Battleship-style · 10 × 10",
    description: "Place your fleet. Find theirs first.",
    rules:
      "Original naval deduction game. Each fleet has ships of lengths 5, 4, 3, 3 and 2. Place horizontally or vertically without overlap. Touching is allowed. Deploy all five ships, then alternate one shot per turn, even after a hit. A ship sinks when every cell is hit. Destroy all 17 enemy ship cells to win. Enemy positions remain hidden until match end.",
  },
  {
    id: "words",
    name: "Imperial Wordcraft",
    icon: "W",
    category: "Words",
    players: 2,
    tag: "Original word tiles · 11 × 11",
    description: "Make a little room for a bigger vocabulary.",
    rules:
      "Original 11×11 word-tile duel. Seven tiles per rack; no blanks. First word covers the center. New tiles occupy one row/column with no gaps and connect to the board. Every main and cross word must exist in the bundled American-English dictionary. Score all formed words using displayed tile values, plus 10 for playing all seven. No premium squares. Exchange selected tiles only with 7+ left in bag, or pass. Six consecutive scoreless turns or an empty bag plus an empty rack ends the game. Subtract remaining racks; a player going out adds the opponent’s remainder. Highest score wins. Dictionary is a local SCOWL-derived list, not an official Scrabble tournament lexicon.",
  },
  {
    id: "connectfour",
    name: "Connect Four",
    icon: "◉",
    category: "Strategy",
    players: 2,
    tag: "Gravity · 7 × 6",
    description: "Drop a disc. Set the trap. Make four.",
    rules:
      "Two players alternate dropping discs into seven columns of a six-row board. Discs fall to the lowest empty cell. Red starts. Four or more connected discs horizontally, vertically, or diagonally wins. Full columns cannot be played. A full board without a winning line is a draw.",
  },
  {
    id: "backgammon",
    name: "Backgammon",
    icon: "⚂",
    category: "Dice & strategy",
    players: 2,
    tag: "Cubeless · first to 5",
    description: "Race your checkers home. Make the dice count.",
    rules:
      "Cubeless match to five points. Ivory travels 24 to 1; Onyx travels 1 to 24. Each side starts with 15 checkers. Each rolls one opening die; ties reroll, higher starts using both numbers. Later doubles give four moves. Two or more enemy checkers block a point; a lone enemy checker is hit to the bar. Bar checkers must enter before any others move. Each die is separate. You must use the maximum possible number of dice; if only one of two different dice can be used, the larger playable die is compulsory. Bearing off requires every active checker home and none on the bar. Exact dice bear off; overshoots may bear off only the farthest checker. Wins score one; gammon scores two if the loser has borne off none; backgammon scores three if that loser also has a checker on the bar or in the winner’s home board. No doubling cube, Crawford rule, or monetary stakes in this cubeless format.",
  },
  {
    id: "spades",
    name: "Spades",
    icon: "♠",
    category: "Cards",
    players: 4,
    tag: "Partners · first to 500",
    description: "Bid your hand. Protect your partner. Watch the bags.",
    rules:
      "Four-player partnership Spades, seats South/North against West/East, standard 52-card deck, ace high. Bid 0–13 in turn, with zero declaring nil. Dealer rotates; dealer’s left leads. Follow suit when able. Spades always trump and cannot lead until broken unless holding only spades. Team contract is the sum of bids. Non-nil tricks make the contract: score 10 per bid trick if made or lose 10 per bid trick if set. Overtricks score one and add one bag; each ten accumulated bags costs 100, retaining the remainder. Nil scores +100 for zero tricks or −100 if failed. House variant: failed-nil tricks do not help the partner’s contract but each scores one point and one bag. No blind nil or card exchange. First team to at least 500 wins if ahead; a tied score continues.",
  },
  {
    id: "reversi",
    name: "Reversi",
    icon: "◐",
    category: "Strategy",
    players: 2,
    tag: "Disc flipping · 8 × 8",
    description: "Take the corners. Turn the whole board.",
    rules:
      "8×8 disc-flipping game with the standard four-disc center opening; Black moves first. Place on an empty square to bracket one or more consecutive opposing discs with another of your discs in a straight horizontal, vertical, or diagonal line. Flip every bracketed line. A move must flip at least one disc. You must pass if no move exists and cannot pass otherwise. The game ends when neither player can move, even with empty squares left. Most discs wins; equal counts draw.",
  },
  {
    id: "gomoku",
    name: "Gomoku",
    icon: "✥",
    category: "Strategy",
    players: 2,
    tag: "Exact five · 15 × 15",
    description: "Build a quiet threat. Finish with five.",
    rules:
      "Casual exact-five Gomoku on 15×15 intersections. Black starts; players alternate placing one stone on an empty intersection. Exactly five uninterrupted stones in a horizontal, vertical, or diagonal row wins. Six or more in one row does not win, but is not forbidden. A full board without an exact five is a draw. This room uses free opening placement, without tournament swap openings or Renju forbidden-move rules.",
  },
];
games.push(...[
  {
    "id": "rummy6",
    "name": "Rummy · 6 players",
    "icon": "♦",
    "category": "Cards",
    "players": 6,
    "tag": "Six seats · first to 100",
    "description": "One shared table. Six private hands.",
    "rules": "Six-player straight rummy. Six cards each, ace low. Draw then optionally meld once, lay off, and discard. A taken discard cannot be immediately returned. Going out scores all opponents remaining cards. Stock exhaustion draws the hand without recycling. First to 100."
  },
  {
    "id": "poker2",
    "name": "NLHE · 2-max",
    "icon": "♠",
    "category": "Poker",
    "players": 2,
    "tag": "2 seats · no-limit hold’em",
    "description": "Shared board. Private hole cards. Your decision.",
    "rules": "2-seat no-limit Texas hold’em. Each seat starts with 1,000 local table chips, blinds 5/10. Fold, check/call, or raise to a total street amount. Minimum full raise is the preceding full raise, with short all-ins allowed; short raises reopen only after a full cumulative raise. Five-card best hand, side pots, tied pots, clockwise odd chips. Uncalled excess returns. Dealer rotates; heads-up dealer posts small blind. No ante, cash value, wallet settlement, rake, or rebuy in this local rules preview."
  },
  {
    "id": "poker4",
    "name": "NLHE · 4-max",
    "icon": "♠",
    "category": "Poker",
    "players": 4,
    "tag": "4 seats · no-limit hold’em",
    "description": "Shared board. Private hole cards. Your decision.",
    "rules": "4-seat no-limit Texas hold’em. Each seat starts with 1,000 local table chips, blinds 5/10. Fold, check/call, or raise to a total street amount. Minimum full raise is the preceding full raise, with short all-ins allowed; short raises reopen only after a full cumulative raise. Five-card best hand, side pots, tied pots, clockwise odd chips. Uncalled excess returns. Dealer rotates; heads-up dealer posts small blind. No ante, cash value, wallet settlement, rake, or rebuy in this local rules preview."
  },
  {
    "id": "poker6",
    "name": "NLHE · 6-max",
    "icon": "♠",
    "category": "Poker",
    "players": 6,
    "tag": "6 seats · no-limit hold’em",
    "description": "Shared board. Private hole cards. Your decision.",
    "rules": "6-seat no-limit Texas hold’em. Each seat starts with 1,000 local table chips, blinds 5/10. Fold, check/call, or raise to a total street amount. Minimum full raise is the preceding full raise, with short all-ins allowed; short raises reopen only after a full cumulative raise. Five-card best hand, side pots, tied pots, clockwise odd chips. Uncalled excess returns. Dealer rotates; heads-up dealer posts small blind. No ante, cash value, wallet settlement, rake, or rebuy in this local rules preview."
  },
  {
    "id": "poker8",
    "name": "NLHE · 8-max",
    "icon": "♠",
    "category": "Poker",
    "players": 8,
    "tag": "8 seats · no-limit hold’em",
    "description": "Shared board. Private hole cards. Your decision.",
    "rules": "8-seat no-limit Texas hold’em. Each seat starts with 1,000 local table chips, blinds 5/10. Fold, check/call, or raise to a total street amount. Minimum full raise is the preceding full raise, with short all-ins allowed; short raises reopen only after a full cumulative raise. Five-card best hand, side pots, tied pots, clockwise odd chips. Uncalled excess returns. Dealer rotates; heads-up dealer posts small blind. No ante, cash value, wallet settlement, rake, or rebuy in this local rules preview."
  },
  {
    "id": "blackjack",
    "name": "Blackjack",
    "icon": "♦",
    "category": "Casino practice",
    "players": 1,
    "tag": "Local practice · table chips",
    "description": "Practice the table rules with imaginary chips.",
    "rules": "Local single-player blackjack against dealer. Six-deck fresh shoe each hand, stand on soft 17, blackjack 3:2, ties push. Dealer checks for blackjack before player decisions. Hit, stand, or double on first two cards. This starting rules variant has no splitting, insurance, or surrender. Even table-chip stakes 2–100. Table chips have no cash value and are not IGT or wallet funds."
  },
  {
    "id": "roulette",
    "name": "American Roulette",
    "icon": "♦",
    "category": "Casino practice",
    "players": 1,
    "tag": "Local practice · table chips",
    "description": "Practice the table rules with imaginary chips.",
    "rules": "American double-zero roulette. Select a USD-display practice chip from $0.10 to $1,000; $1,000 is a rectangular plaque. Click repeatedly to accumulate multiple bets, undo, clear, then spin. Straight 35:1, split 17:1, street/trio 11:1, corner 8:1, six-line 5:1, first-five 6:1, dozens/columns 2:1, even-money outside bets 1:1. Zeros lose all ordinary outside bets. All amounts are exact practice cents with no wallet connection. Currency equivalents are indicative market estimates, not accepted settlement quotes."
  },
  {
    "id": "craps",
    "name": "Craps",
    "icon": "♦",
    "category": "Casino practice",
    "players": 1,
    "tag": "Local practice · table chips",
    "description": "Practice the table rules with imaginary chips.",
    "rules": "Pass line: come-out 7/11 wins, 2/3/12 loses; other totals establish point, then point wins and seven loses. Dont pass reverses wins/losses, with come-out 12 pushing. Field pays 1:1 on 3/4/9/10/11, 2:1 on 2/12. One line or field bet at a time; no odds/place/come/prop bets in this version. Table chips have no cash value and are not IGT or wallet funds."
  },
  {
    "id": "baccarat",
    "name": "Baccarat",
    "icon": "♦",
    "category": "Casino practice",
    "players": 1,
    "tag": "Local practice · table chips",
    "description": "Practice the table rules with imaginary chips.",
    "rules": "Eight-deck fresh shoe each hand. Standard punto banco third-card rules, naturals 8/9 stand. Player pays 1:1, banker pays 0.95:1 (5% commission), tie pays 8:1. Player/banker bets push on ties. Stakes are 20–100 table chips in multiples of 20. Table chips have no cash value and are not IGT or wallet funds."
  }
]);
games.push({id:"battleship6",name:"Fleet Command · 6 ships",icon:"⚓",category:"Deduction",players:2,tag:"Six-ship fleet · 10 × 10",description:"Deploy six ships. Destroy the opposing fleet.",rules:"Imperial six-ship format: Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Patrol 2 and Destroyer 2. Place all six inside the 10 by 10 grid, horizontally or vertically, without overlap; touching is allowed. Deployment locks placement. South fires first, then one shot per turn even after a hit. No repeated shots. All 19 occupied enemy cells must be hit to win. Opponent positions remain private until sunk or match end."});
for(const count of [7,9]) games.push({...games.find(g=>g.id==='poker6'),id:'poker'+count,name:`NLHE · ${count}-max`,players:count,tag:`${count} seats · no-limit hold’em`});
for(const count of [2,4,6,7,8,9])games.push({id:'omaha'+count,name:`Omaha PLO · ${count}-max`,icon:'♠',category:'Poker',players:count,tag:`${count} seats · pot-limit Omaha`,description:'Four hole cards. Exactly two play. Pot-limit betting and practice freezeout tournaments.',rules:'Four-card Omaha high only, pot limit. Every showdown hand must use exactly two of your four hole cards and exactly three of the five community cards. No low split. Dealer and blinds rotate, with the button posting small blind heads up. Raises must meet the minimum or be a short all-in and cannot exceed the pot after calling. A short all-in does not reopen betting until a full raise is faced. Short blinds count as full blinds for preflop pot-limit calculations. Side pots pay eligible hands; uncalled excess returns; tied pots split with odd chips clockwise after the button. Local table chips have no cash value. Freezeouts carry chips between hands, increase blinds, balance tables, and award the final prize pool with no per-hand tournament rake.'});
for(const [id,name,rules] of [
 ['pineapple6','Classic Pineapple','Three private cards; discard exactly one before preflop betting. Then no-limit Holdem betting with two hole cards and a five-card board. Best five cards, using zero, one or two hole cards, win.'],
 ['crazy6','Crazy Pineapple','Three private cards during preflop and flop betting. Every live player, including all-in players, discards exactly one after flop betting and before the turn. Then play with two hole cards. Discards remain private. No-limit, high only.'],
 ['lazy6','Lazy Pineapple','Keep three private cards through all betting rounds. At showdown make the best five-card hand using at most two hole cards and at least three board cards. No forced discard. No-limit, high only.'],
 ['stud5','Five-card Stud','Imperial no-limit, high-only five-card stud. Each player posts an ante, then receives one downcard and one upcard. Lowest upcard posts a full bring-in; ties use clubs, diamonds, hearts, spades. Three more cards arrive face up, with betting after each. On later streets the highest exposed hand acts first; ties start clockwise after the dealer. There is no community board and no draw. Ante and full bring-in increase with tournament levels.'],
 ['draw5','Five-card Draw','No-limit, high-only single draw. Five private cards, blinds and a first betting round; every live player may replace zero to five cards once, then a final betting round and five-card showdown. No community board, jokers, wild cards or opening-hand requirement. If the stock runs out, previous players discarded cards may be shuffled; you cannot draw your own current discards.']
])games.push({id,name:name+' · 6-max',icon:'♠',category:'Poker',players:6,tag:'6 seats · high-only practice',description:rules,rules:rules+' Side pots, uncalled returns and split pots apply. Tournament chips have no cash value; entry fees/buy-ins fund prizes with the 96/3/1 split once, and no per-hand tournament rake.'});
games.push({id:'progressive5',name:'Progressive Draw · 6-max',icon:'♠',category:'Poker',players:6,tag:'6 seats · escalating opening bet',description:'Five-card draw with an opening-bet ladder: Jacks, Queens, trips, straight, flush, full house, quads, straight flush, royal.',rules:'Imperial progressive high draw: five private cards. The first deal requires Jacks or better to open with a bet. If all players pass, redeal and increase the requirement to Queens or better, three of a kind, straight, flush, full house, four of a kind, straight flush, then royal flush. Stronger hands qualify. At the top, keep requiring royal until someone opens. Once a qualifying bet opens play, everyone may call, raise or fold normally, then take one draw of zero to five cards, final betting and high-hand showdown. Reset to Jacks on the next hand. This practice format has no antes or forced blinds on unopened deals, so repeated passes do not consume stacks. The big-blind setting controls the minimum opening bet and raises. No community board. Previous discards may recycle if needed, excluding your own current discards. Local bot tournaments refund if their action limit is exceeded; they never bypass the opening requirement.'});

games.push({id:'triple27',name:'2–7 Triple Draw · 6-max',icon:'♠',category:'Poker',players:6,tag:'6 seats · no-limit lowball',description:'Five private cards. Three draws, four betting rounds. Lowest hand wins; aces high, straights and flushes count against you.',rules:'No-limit deuce-to-seven triple draw. Deal five private cards, initial betting, then three draws of zero to five replacements, each followed by betting. Four betting rounds total; no community board. Aces are always high: A-2-3-4-5 is ace-high, not a straight. Straights and flushes count against you. Compare poker categories in reverse, then ranks from highest to lowest; 7-5-4-3-2 of mixed suits is best. Pairs and stronger categories remain valid hands but lose to lower categories; identical ranks split regardless of suits. Blinds rotate, including heads-up button/small blind. Previous discards can recycle when needed, excluding your own current discards. Every live player, including all-in players, chooses on all three draws. Side pots, uncalled returns and odd chips clockwise after the button apply. Tournaments carry chips, increase blinds and use the same entry-only 96/3/1 allocation. This replaces the proposed custom 5+3+3 board game.'});

export const byId = Object.fromEntries(games.map((g) => [g.id, g]));
