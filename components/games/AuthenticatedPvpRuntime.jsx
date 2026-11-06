import {pvpFleetVerifier} from '../../review/pvp-runtime/dist/pvp-fleet-verification.js';
import React,{useEffect,useRef,useState} from 'react';
import {gameView} from '../../review/pvp-runtime/dist/view.js';
import {modelStage,updateModel,stopModel,hasModel} from '../../review/pvp-runtime/dist/model-view.js';
import {unityStage,updateUnity,clearUnity} from '../../review/pvp-runtime/dist/unity-view.js';
import {soundButton,observeAudio,resetAudioContext} from '../../review/pvp-runtime/dist/game-audio.js';
import style from '../../review/pvp-runtime/game-style.mjs';
export default function AuthenticatedPvpRuntime({snapshot,onAction,busy,presentation='standard',active=true,viewerId}){
 const audio=useRef(null),shell=useRef(null),root=useRef(null),lastRevision=useRef(null),ui=useRef({cards:new Set(),rack:new Set(),draft:[],chessFrom:null,checkFrom:null,domino:null,alone:false,vertical:false,busy:false}),[,refresh]=useState(0),[promotion,setPromotion]=useState(null);
 ui.current.promote=move=>setPromotion(move);
 const renderer=hasModel(snapshot?.view?.game)?'model':'unity';
 useEffect(()=>{if(!active)return undefined;const stage=renderer==='model'?modelStage():unityStage();shell.current.prepend(stage);return()=>{if(renderer==='model')stopModel(stage);else clearUnity(stage);stage.remove();};},[active,renderer]);
 useEffect(()=>{const control=soundButton();audio.current.replaceChildren(control);return()=>{resetAudioContext();control.remove();};},[viewerId,snapshot.roomId]);
 useEffect(()=>{
  if(snapshot?.viewerId!==viewerId||!snapshot?.view||!root.current)return;
  if(lastRevision.current!==snapshot.revision){ui.current.cards.clear();ui.current.rack.clear();ui.current.chessFrom=null;lastRevision.current=snapshot.revision;}
  ui.current.busy=busy;
  const room=snapshot.view.game?.startsWith('battleship')?pvpFleetVerifier.observe(snapshot,viewerId):snapshot.view;
  if(!room){root.current.textContent='Fleet verification unavailable: authenticated room/viewer context was not confirmed.';return;}
  const view=gameView(room,ui.current,action=>{if(!busy&&active)onAction(action);},()=>refresh(n=>n+1));root.current.replaceChildren(view);if(active)observeAudio(room);if(active){if(renderer==='model')updateModel(snapshot.view,root.current);else updateUnity(root.current,snapshot.view.game);}
 });
 return <section className="ig-pvp-game"><style>{style}</style><div ref={audio} aria-label="Game sound controls"/>{promotion&&<fieldset><legend>Choose promotion piece</legend>{[['q','Queen'],['r','Rook'],['b','Bishop'],['n','Knight']].map(([piece,label])=><button key={piece} type="button" disabled={busy} className="min-h-11 border px-3" onClick={()=>{onAction({type:'play',...promotion,promotion:piece});setPromotion(null);}}>Promote to {label}</button>)}</fieldset>}<div ref={shell}>{presentation==='chess-table'?<details className="ig-chess-board-controls"><summary>Board controls · keyboard and touch alternative</summary><div ref={root}/></details>:<div ref={root}/>}</div></section>;
}
