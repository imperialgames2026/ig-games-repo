const extraVariants={pineapple6:'pineapple',crazy6:'crazy_pineapple',lazy6:'lazy_pineapple',stud5:'stud5',draw5:'draw5',progressive5:'progressive_draw',triple27:'triple27'};
export const isPokerGame = id => /^(poker|omaha)(2|4|6|7|8|9)$/.test(id || '') || Object.hasOwn(extraVariants,id||'');
export const isOmahaGame = id => /^omaha(2|4|6|7|8|9)$/.test(id || '');
export const pokerVariant = id => extraVariants[id] || (isOmahaGame(id)?'omaha':'holdem');
