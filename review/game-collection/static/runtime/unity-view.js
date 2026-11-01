import { createWasmUrl } from '../unity/wasm-url.js';
import { h,button } from './view.js';
let instance,loading,stage,notice,host,latest,targets=[];
window.imperialUnityPick=id=>{const target=targets[Number(id)];if(target?.isConnected&&!target.disabled&&Number(stage?.closest('.game-window')?.dataset.inputBlockedUntil||0)<performance.now())target.click();};
export function unityStage(){
 if(!stage){notice=h('p',{role:'status'},'Unity 3D tabletop · loading when you open the table.');host=h('div',{class:'unity-canvas-host'});stage=h('div',{class:'unity-stage'},notice,host);}
 return stage;
}
async function load(){
 const response=await fetch('/game-collection/unity/Build/manifest.json');if(!response.ok)throw Error('Unity build is not available. The standard game controls below are ready.');const manifest=await response.json();
 await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/game-collection/unity/Build/'+manifest.loader;script.onload=resolve;script.onerror=reject;document.head.append(script);});
 const canvas=h('canvas',{id:'imperial-unity-canvas',tabindex:0,'aria-label':'Unity 3D game table — use the standard controls below as an accessible alternative'});host.append(canvas);
 const codeUrl=await createWasmUrl(manifest,new URL('/game-collection/unity/Build/',location.href));
 try { instance=await window.createUnityInstance(canvas,{dataUrl:'/game-collection/unity/Build/'+manifest.data,frameworkUrl:'/game-collection/unity/Build/'+manifest.framework,codeUrl,companyName:'Imperial',productName:'Imperial Tabletop',productVersion:'1.0'},p=>{notice.textContent='Loading Unity 3D · '+Math.round(p*100)+'%';}); } finally { URL.revokeObjectURL(codeUrl); }
 notice.textContent='Unity 3D · click pieces and cards here, or use the standard controls below.';if(latest)publish(latest);
}
export function pauseUnity(){if(instance)instance.SendMessage('ImperialTabletop','SetVisible','0');}
function publish(model){instance.SendMessage('ImperialTabletop','SetVisible','1');instance.SendMessage('ImperialTabletop','SetScene',JSON.stringify(model));}
export function updateUnity(gameRoot,game){
 if(!stage?.isConnected)return;
 // Read only the authorized, already rendered player view. No hidden server state enters Unity.
 const selectors='.board-square,.reversi-cell,.gomoku-cell,.connect-hole,.drop-column,.bg-point,.playing-card,.domino,.sea-cell,.word-cell,.rack-tile';
 const nodes=[...gameRoot.querySelectorAll(selectors)].filter(n=>n.getBoundingClientRect().width>0);
 if(!nodes.length){notice.textContent='Use the game controls below for this phase.';return;}
 const bounds=nodes.map(n=>n.getBoundingClientRect()),left=Math.min(...bounds.map(r=>r.left)),top=Math.min(...bounds.map(r=>r.top)),right=Math.max(...bounds.map(r=>r.right)),bottom=Math.max(...bounds.map(r=>r.bottom));
 const scale=12/Math.max(right-left,300),width=(right-left)*scale,depth=(bottom-top)*scale;
 targets=nodes;const objects=nodes.map((node,i)=>{const r=bounds[i],label=node.getAttribute('aria-label')||node.textContent.trim(),cls=node.className;let kind='tile',piece='',count=0,color=cls.includes('dark')?'#654532':'#bc9b70';
  if(game==='chess'&&/White|Black/.test(label)){kind='chess';piece=label.includes('White')?'#eee5cf':'#252231';}
  else if(node.querySelector('.checker,.flat-disc')||/disc-red|disc-gold/.test(cls)){kind='disc';piece=node.querySelector('.white-stone,.ivory')?'#eee5cf':/disc-red|red-piece/.test(cls)||node.querySelector('.checker:not(.ivory)')?'#b9354e':'#24202c';}
  if(kind==='disc')count=node.textContent.includes('♛')?2:1;
  if(cls.includes('connect-hole')){kind='disc';count=1;piece=cls.includes('disc-red')?'#b9354e':cls.includes('disc-gold')?'#e7b94b':'#101321';}
  if(cls.includes('bg-point')){kind='backgammon';count=Number(/Point \d+, (\d+)/.exec(label)?.[1]||0);piece=label.includes('Ivory')?'#eee5cf':'#252231';}
  if(cls.includes('domino')){kind='domino';color='#403b50';}
  if(cls.includes('sea-cell'))color=cls.includes('hit')?'#bf4264':cls.includes('ship')?'#73899a':'#194c6a';
  if(cls.includes('playing-card'))color='#43334f';else if(cls.includes('reversi'))color='#326f58';else if(cls.includes('connect-hole'))color='#303b8b';
  if(/chosen|selected|legal|last-/.test(cls))color='#977144';
  const display=kind==='chess'?label:node.matches('.word-cell,.rack-tile')?node.textContent.trim():node.matches('.board-square,.reversi-cell,.gomoku-cell')?(game==='chess'?node.textContent.trim():''):node.matches('.sea-cell')?node.textContent.trim():label.replace(/♠/g,'S').replace(/♥/g,'H').replace(/♦/g,'D').replace(/♣/g,'C').replace(/\s+/g,' ').slice(0,20);
  return {kind,piece,count,color,label:display,x:((r.left+r.right)/2-left)*scale-width/2,z:depth/2-((r.top+r.bottom)/2-top)*scale,w:r.width*scale*.98,d:r.height*scale*.98,pick:node.matches('button')?String(i):'',selected:cls.includes('selected')||cls.includes('chosen')};
 });
 latest={width,depth:Math.max(depth,2),objects};if(instance)publish(latest);else if(!loading)loading=load().catch(e=>{notice.textContent=e.message||'Unity could not load. Use the standard game controls below.';});
}
