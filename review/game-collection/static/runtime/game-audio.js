let enabled=false,previous=null;
try{enabled=localStorage.getItem('imperial-sound')==='on';}catch{}
const clips=new Map();
export function cueFor(before,room){
 if(!before||before.id!==room.id||room.version<=before.version)return null;
 const s=room.state,log=(s.log||[]).at(-1)||'';
 if(s.over&&!before.over)return 'win';
 if(/sunk|\bhit\b/i.test(log))return 'hit';
 if(/miss/i.test(log))return 'miss';
 if(/raises|calls|bets|receives|wager/i.test(log))return 'chips';
 if(s.round!==before.round||/draws|discards|deals/i.test(log))return 'deal';
 if(s.turn===room.seat&&before.turn!==s.turn)return 'turn';
 return 'move';
}
function play(name){
 if(!enabled||document.hidden||!name)return;
 let clip=clips.get(name);if(!clip){clip=new Audio('/game-collection/assets/audio/'+name+'.wav');clip.volume=.6;clips.set(name,clip);}
 clip.currentTime=0;clip.play().catch(()=>{});
}
export function observeAudio(room){const cue=cueFor(previous,room);previous={id:room.id,version:room.version,over:room.state.over,round:room.state.round,turn:room.state.turn};play(cue);}
export function soundButton(){const b=document.createElement('button');b.type='button';const refresh=()=>{b.textContent=enabled?'Sound on':'Sound off';b.setAttribute('aria-pressed',String(enabled));};refresh();b.onclick=()=>{enabled=!enabled;try{localStorage.setItem('imperial-sound',enabled?'on':'off');}catch{}refresh();if(enabled)play('move');};return b;}
