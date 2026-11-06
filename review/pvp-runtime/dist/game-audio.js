// Original, replaceable WAV assets; only authorized visible state selects a cue.
export const soundAssets=Object.freeze(Object.fromEntries(['move','deal','chips','hit','miss','turn','win','dice','stone','domino'].map(n=>[n,'/pvp3d-audio/'+n+'.wav'])));
let enabled=true,volume=.45,previous=null,unlocked=false,lastPlayed=0;
try{enabled=localStorage.getItem('imperial-sound')!=='off';const saved=localStorage.getItem('imperial-volume');if(saved!==null&&Number.isFinite(Number(saved)))volume=Math.max(0,Math.min(1,Number(saved)));}catch{}
const clips=new Map();
export function cueFor(before,room){
 if(!before||before.id!==room.id||room.version<=before.version)return null;
 const s=room.state,log=(s.log||[]).slice(before.logCount??0).join(' ');
 if(s.over&&!before.over)return 'win';
 if(/sunk|\bhit[!.]/i.test(log))return 'hit';
 if(/miss/i.test(log))return 'miss';
 if(/raises|calls|bets|receives|wager/i.test(log))return 'chips';
 if(s.round!==before.round||/draws|discards|deals/i.test(log))return 'deal';
 if(s.turn===room.seat&&before.turn!==s.turn)return 'turn';
 if(['craps','backgammon'].includes(room.game))return 'dice';
 if(room.game==='dominoes')return 'domino';
 if(['chess','checkers','reversi','gomoku','connectfour','words'].includes(room.game))return 'stone';
 return 'move';
}
function play(name,preview=false){
 if(!enabled||!unlocked||document.hidden||!soundAssets[name]||volume===0)return;
 const now=performance.now();if(!preview&&now-lastPlayed<100)return;lastPlayed=now;
 let clip=clips.get(name);if(!clip){clip=new Audio(soundAssets[name]);clip.preload='auto';clips.set(name,clip);}
 clip.volume=volume;clip.currentTime=0;clip.play().catch(()=>{});
}
if(typeof document!=='undefined'){
 const unlock=()=>{unlocked=true;};document.addEventListener('pointerdown',unlock,{once:true});document.addEventListener('keydown',unlock,{once:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const clip of clips.values())clip.pause();});
}
export function observeAudio(room){const cue=cueFor(previous,room);previous={id:room.id,version:room.version,over:room.state.over,round:room.state.round,turn:room.state.turn,logCount:(room.state.log||[]).length};play(cue);}
export function soundButton(){
 const box=document.createElement('div');box.className='sound-controls';
 const toggle=document.createElement('button');toggle.type='button';
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Volume';details.append(summary);
 const panel=document.createElement('div');panel.className='sound-panel';
 const label=document.createElement('label');label.textContent='Game volume ';
 const range=document.createElement('input');range.type='range';range.min=0;range.max=100;range.step=5;range.value=Math.round(volume*100);range.setAttribute('aria-label','Game volume');
 const output=document.createElement('output');output.textContent=range.value+'%';label.append(range,output);
 const preview=document.createElement('button');preview.type='button';preview.textContent='Preview sound';
 const note=document.createElement('small');note.textContent='Moves, cards, chips and turn alerts. Settings save on this browser.';
 panel.append(label,preview,note);details.append(panel);box.append(toggle,details);
 const refresh=()=>{toggle.textContent=enabled?'Sound on':'Sound off';toggle.setAttribute('aria-pressed',String(enabled));};refresh();
 toggle.onclick=()=>{unlocked=true;enabled=!enabled;try{localStorage.setItem('imperial-sound',enabled?'on':'off');}catch{}if(!enabled)for(const c of clips.values())c.pause();refresh();if(enabled)play('move',true);};
 range.oninput=()=>{volume=Number(range.value)/100;output.textContent=range.value+'%';for(const c of clips.values())c.volume=volume;try{localStorage.setItem('imperial-volume',String(volume));}catch{}};
 preview.onclick=()=>{unlocked=true;if(!enabled){enabled=true;try{localStorage.setItem('imperial-sound','on');}catch{}refresh();}play('stone',true);};
 return box;
}

export function resetAudioContext(){previous=null;for(const clip of clips.values())clip.pause();}
