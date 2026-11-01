import {games,byId} from './runtime/games/catalog.js';
import {createGame,applyGame,authorizedAction,playerView,pendingBot,botAction} from './engine-browser.js';
import {gameView} from './runtime/view.js';
import {modelStage,hasModel,updateModel,stopModel} from './runtime/model-view.js';
import {unityStage,updateUnity,pauseUnity} from './runtime/unity-view.js';
import {soundButton,observeAudio} from './runtime/game-audio.js';
import {tournamentCapability} from './runtime/games/tournament-capabilities.js';
const actor='local-review-player',q=id=>document.getElementById(id),controls=q('controls'),stage=q('stage'),select=q('game');
let room,epoch=0,locked=false,unityPoll,timer;const ui={cards:new Set(),rack:new Set(),draft:[],chessFrom:null,checkFrom:null,domino:null,alone:false,vertical:false,busy:false};
function clearSelections(){ui.cards.clear();ui.rack.clear();ui.draft=[];ui.chessFrom=null;ui.checkFrom=null;ui.domino=null;}
function status(){q('window').dataset.game=room.game;q('window').dataset.version=String(room.version);q('window').dataset.phase=room.state.phase;q('summary').textContent=byId[room.game].name+' · local revision '+room.version+' · '+room.state.phase+' · you play seat 1 against practice bots';q('demo').disabled=locked||room.state.over;q('reset').disabled=locked;}
function error(e){q('error').textContent=e?.message||String(e);}
ui.promote=move=>{const dialog=q('promotion'),buttons=q('promotion-buttons');buttons.replaceChildren();for(const[piece,label]of[['q','Queen'],['r','Rook'],['b','Bishop'],['n','Knight']]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{dialog.close();play({...move,type:'play',promotion:piece});};buttons.append(b);}dialog.showModal();};
async function render(){
 if(!room)return;const ticket=epoch,id=room.id;ui.busy=locked;const view=playerView(room,actor);controls.replaceChildren(gameView(view,ui,a=>{if(room.id===id)play(a);},()=>render()));status();observeAudio(view);
 if(hasModel(room.game)){
  q('window').dataset.renderer='three-loading';pauseUnity();if(!stage.querySelector('#model-stage'))stage.replaceChildren(modelStage());q('progress').textContent='Loading the authored 3D model…';
  await updateModel(view,controls);if(ticket!==epoch)return;stage.querySelectorAll('.poker-seat-label').forEach(button=>{button.disabled=true;button.title='Local practice seat, not an account profile';button.setAttribute('aria-label','Local practice seat: '+(button.querySelector('strong')?.textContent||'Practice bot'));});
  const failed=stage.textContent.includes('could not load');q('window').dataset.renderer=failed?'fallback':'three';q('progress').textContent=failed?'Model unavailable; original controls remain usable.':'Original dedicated 3D model · click the table or use the controls below.';
 }else{
  stopModel();stage.replaceChildren(unityStage());updateUnity(controls,room.game);q('window').dataset.renderer='unity-loading';q('progress').textContent='Supplied Unity 3D tabletop loading; original controls are usable.';clearInterval(unityPoll);
  unityPoll=setInterval(()=>{if(ticket!==epoch){clearInterval(unityPoll);return;}const text=stage.textContent||'';if(text.includes('click pieces and cards here')){q('window').dataset.renderer='unity';q('progress').textContent='Supplied Unity 3D tabletop · click pieces/cards or use the controls below.';clearInterval(unityPoll);}else if(/could not|not available/i.test(text)){q('window').dataset.renderer='fallback';q('progress').textContent=text;clearInterval(unityPoll);}},100);
 }
}
async function drainBots(ticket){
 for(let n=0;n<64&&ticket===epoch;n++){
  const p=pendingBot(room);if(p===null)return;
  await new Promise(resolve=>{timer=setTimeout(resolve,60);});if(ticket!==epoch)return;
  const action=botAction(room.game,room.state,p);if(!action)return;
  room.state=applyGame(room.game,room.state,{...action,player:p});room.version++;clearSelections();await render();
 }
 if(pendingBot(room)!==null)q('progress').textContent='Bot step budget reached; use Demo move to continue this local review.';
}
async function play(action){
 if(locked||room.state.over)return;locked=true;q('error').textContent='';const ticket=epoch;
 try{room.state=authorizedAction(room,actor,action);room.version++;clearSelections();await render();await drainBots(ticket);}catch(e){error(e);}finally{if(ticket===epoch){locked=false;await render();}}
}
async function choose(id){
 epoch++;clearTimeout(timer);clearInterval(unityPoll);locked=false;stopModel();pauseUnity();stage.replaceChildren();clearSelections();q('error').textContent='';
 const entry=byId[id];if(!entry)throw Error('Unknown authored game');const seed=crypto.getRandomValues(new Uint32Array(1))[0];room={id:'review-'+id+'-'+epoch,game:id,title:entry.name+' · local practice review',owner:actor,version:1,names:{[actor]:'You · local demo'},seats:Array(entry.players).fill(null),state:createGame(id,seed)};room.seats[0]=actor;select.value=id;q('rules').textContent=entry.rules;
 q('boundary').textContent=id==='spades'?'Authored Spades tournament format: '+(tournamentCapability('spades',4,'team_elimination').canRun?'fixed-partnership team elimination. No registration or payouts in this review.':'not eligible.'):(id==='poker7'||id==='omaha7')?'Author seven-seat preview only; the deployed poker format list remains unchanged.':'This standalone review has no hosted multiplayer, identity, payment or fairness service.';
 history.replaceState(null,'',location.pathname+'?game='+encodeURIComponent(id));await render();locked=true;try{await drainBots(epoch);}catch(e){error(e);}finally{locked=false;await render();}
}
for(const entry of games){const o=document.createElement('option');o.value=entry.id;o.textContent=entry.name+' · '+entry.players+' seats';select.append(o);}
select.onchange=()=>choose(select.value).catch(error);q('reset').onclick=()=>choose(select.value).catch(error);q('sound').append(soundButton());
q('demo').onclick=async()=>{if(locked||room.state.over)return;if(room.state.phase==='round')return play({type:'next'});const p=pendingBot(room);if(p!==null){locked=true;try{await drainBots(epoch);}catch(e){error(e);}finally{locked=false;await render();}return;}let action=botAction(room.game,room.state,0);if(action){delete action.player;return play(action);}};
window.addEventListener('pagehide',()=>{epoch++;clearTimeout(timer);clearInterval(unityPoll);stopModel();pauseUnity();});
const requested=new URLSearchParams(location.search).get('game');await choose(games.some(g=>g.id===requested)?requested:'chess');
