const definitions=[
 ['VPIP','Voluntarily Put Money in Pot','The percentage of dealt hands in which a player voluntarily calls or raises before the flop. Posting a required blind alone does not count.'],
 ['PFR','Pre-Flop Raise','The percentage of dealt hands in which a player raises at least once before the flop.'],
 ['3-Bet','Pre-Flop Re-Raise','How often a player re-raises when facing an opening raise before the flop, out of opportunities to do so. The big blind counts as the first bet, the opening raise as the second, and the re-raise as the third.'],
 ['Fold to 3-Bet','Fold to a Pre-Flop Re-Raise','How often a player folds after raising pre-flop and then facing a re-raise, out of those opportunities.'],
 ['C-Bet','Continuation Bet','How often the last pre-flop aggressor bets the flop when given an opportunity to continue betting.'],
 ['Fold to C-Bet','Fold to a Continuation Bet','How often a player folds when facing a continuation bet on the flop, out of those opportunities.'],
 ['Steal','Attempt to Steal the Blinds','How often a player opens with a raise from the cutoff, button, or small blind when everyone before them has folded, out of those opportunities.'],
 ['Check/Raise','Check and Then Raise','How often a player checks and then raises a bet on the same betting round, out of opportunities after checking and facing a bet.'],
 ['WTSD','Went to Showdown','The percentage of hands in which a player reaches showdown after seeing the flop.'],
 ['WSD','Won at Showdown','The percentage of showdowns in which a player wins. Treatment of split pots must follow the published statistics rules.']
];
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node;}
export function profileStats(){
 const section=el('section','profile-game-stats');section.setAttribute('aria-label','Game Stats');
 section.append(el('h3',null,'Game Stats'),el('p','stats-empty','Statistics will appear when recorded hand history is connected. Tap any stat to learn what it means.'));
 const grid=el('div','profile-stat-grid');
 for(const [label,title,description] of definitions){
  const tile=el('button','profile-stat-tile');tile.type='button';tile.setAttribute('aria-label',label+' — explanation');
  tile.append(el('strong',null,'—'),el('span',null,label));
  tile.addEventListener('click',()=>{
   const help=el('dialog','poker-stat-explanation');help.setAttribute('aria-labelledby','poker-stat-heading');
   const heading=el('h2',null,label+' — '+title);heading.id='poker-stat-heading';
   const close=el('button',null,'Close explanation');close.type='button';close.onclick=()=>help.close();
   help.append(heading,el('p',null,description),close);document.body.append(help);
   help.addEventListener('close',()=>{help.remove();if(tile.isConnected)tile.focus({preventScroll:true})});help.showModal();
  });grid.append(tile);
 }
 section.append(grid);return section;
}

export function profileReactions(){
 const section=el('section','profile-reactions');section.setAttribute('aria-label','Reactions and actions');
 section.append(el('h3',null,'Reactions / Actions'));
 const row=el('div','reaction-scroll-row'),strip=el('div','reaction-scroll-strip');strip.setAttribute('aria-label','Reaction choices');
 const status=el('p','reaction-preview-status','Preview reactions');status.setAttribute('role','status');
 for(const [emoji,label] of [['👏','Nice hand'],['👍','Well played'],['🤝','Good game'],['🍀','Good luck'],['😮','Wow'],['😂','Laugh'],['🔥','On fire'],['🧊','Ice cold'],['💪','Strong play'],['🎯','Right on'],['👑','Royal'],['☕','Take a break']]){
  const choice=el('button','reaction-choice');choice.type='button';choice.setAttribute('aria-label',label);choice.title=label;
  choice.append(el('span','reaction-emoji',emoji),el('span','reaction-caption',label));
  choice.onclick=()=>{status.textContent=emoji+' '+label+' · preview only';};strip.append(choice);
 }
 const prev=el('button','reaction-scroll-arrow','‹'),next=el('button','reaction-scroll-arrow','›');
 for(const [control,label,direction] of [[prev,'Scroll reactions left',-1],[next,'Scroll reactions right',1]]){control.type='button';control.setAttribute('aria-label',label);control.onclick=()=>strip.scrollBy({left:direction*strip.clientWidth*.7,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 row.append(prev,strip,next);section.append(row,status);return section;
}
