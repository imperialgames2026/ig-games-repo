import {isPokerGame} from './games/poker-family.js';
import {fitCameraToPoints} from '../../../lib/pvpCameraFit.mjs';
import {chessModelTemplateKey} from '../../../lib/chessModelPieces.mjs';
import {profileStats,profileReactions} from './poker-profile-stats.js';
import {preferences,skins,formatChips,openTableOptions,attachTableHold} from './poker-preferences.js';
import * as T from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/loaders/GLTFLoader.js';
const models={poker2:'NLHE_2',poker4:'NLHE_4',poker6:'NLHE_6',poker8:'NLHE_8',poker7:'NLHE_7',poker9:'NLHE_9',rummy:'Rummy_2',rummy6:'Rummy_6',spades:'Spades_4',blackjack:'Blackjack_7',roulette:'Roulette',craps:'Craps',baccarat:'Baccarat',chess:'Chess',battleship:'Fleet_Command',battleship6:'Fleet_Command'};
for(const count of [2,4,6,7,8,9])models['omaha'+count]='NLHE_'+count;
for(const id of ['pineapple6','crazy6','lazy6','stud5','draw5','progressive5','triple27'])models[id]='NLHE_6';
let active=null;const cache=new Map();
export const hasModel=game=>!!models[game];
export function modelStage(){const box=document.createElement('div');box.id='model-stage';box.className='model-stage';box.setAttribute('aria-label','Interactive 3D table');return box;}
function load(name){if(!cache.has(name))cache.set(name,new GLTFLoader().loadAsync('/pvp3d-models/'+name+'.glb'));return cache.get(name);}
function disposeDynamic(group){group.traverse(o=>{if(o.userData.owned){o.geometry?.dispose();if(o.material?.map)o.material.map.dispose();o.material?.dispose();}});group.clear();}
function label(text,color='#f4ead1',bg=null){const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');ctx.clearRect(0,0,512,256);if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,512,256);}ctx.fillStyle=color;ctx.font='bold 90px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,128);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const o=new T.Mesh(new T.PlaneGeometry(.22,.11),new T.MeshBasicMaterial({map,transparent:!bg,side:T.DoubleSide}));o.rotation.x=-Math.PI/2;o.userData.owned=true;return o;}
function addCard(group,c,x,z,click=null,back=false,y=.86){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=356;const ctx=canvas.getContext('2d');
 ctx.fillStyle=back?'#352049':'#fff8e8';ctx.beginPath();ctx.roundRect(3,3,250,350,16);ctx.fill();ctx.strokeStyle=back?'#c7a668':'#cabfa9';ctx.lineWidth=4;ctx.stroke();
 if(back){ctx.strokeStyle='#a98b5e';ctx.lineWidth=2;for(let k=-350;k<256;k+=22){ctx.beginPath();ctx.moveTo(k,14);ctx.lineTo(k+330,342);ctx.stroke();}ctx.fillStyle='#352049';ctx.fillRect(24,145,208,65);ctx.fillStyle='#e3c58a';ctx.font='bold 24px Georgia';ctx.textAlign='center';ctx.fillText('IMPERIAL',128,183);}
 else{const rank=({1:'A',11:'J',12:'Q',13:'K'})[c.r]||String(c.r),suit={S:'♠',H:'♥',D:'♦',C:'♣'}[c.s];ctx.fillStyle=['H','D'].includes(c.s)?'#aa1830':'#15232b';
 for(let k=0;k<2;k++){ctx.save();if(k){ctx.translate(256,356);ctx.rotate(Math.PI);}ctx.textAlign='center';ctx.font='bold 43px Georgia';ctx.fillText(rank,33,49);ctx.font='37px Georgia';ctx.fillText(suit,33,87);ctx.restore();}
 ctx.textAlign='center';ctx.textBaseline='middle';
 if(c.r>=2&&c.r<=10){const layouts={2:[[128,105],[128,251]],3:[[128,100],[128,178],[128,256]],4:[[83,105],[173,105],[83,251],[173,251]],5:[[83,105],[173,105],[128,178],[83,251],[173,251]],6:[[83,100],[173,100],[83,178],[173,178],[83,256],[173,256]],7:[[83,100],[173,100],[128,139],[83,178],[173,178],[83,256],[173,256]],8:[[83,100],[173,100],[128,139],[83,178],[173,178],[128,217],[83,256],[173,256]],9:[[83,92],[173,92],[83,149],[173,149],[128,178],[83,207],[173,207],[83,264],[173,264]],10:[[83,92],[173,92],[128,121],[83,149],[173,149],[83,207],[173,207],[128,235],[83,264],[173,264]]};ctx.font='43px Georgia';for(const [px,py] of layouts[c.r])ctx.fillText(suit,px,py);}
 else{ctx.font='90px Georgia';ctx.fillText(suit,128,180);}
 if(c.r>10){ctx.font='bold 48px Georgia';ctx.fillText(rank,128,112);ctx.fillText(rank,128,252);}
 }
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
 const o=new T.Mesh(new T.PlaneGeometry(.12,.17),new T.MeshStandardMaterial({map,transparent:true,side:T.DoubleSide,roughness:.6,metalness:0}));o.rotation.x=-Math.PI/2;o.position.set(x,y,z);o.userData={owned:true,click};group.add(o);return o;
}
function buttonCard(root,c){const rank=({1:'A',11:'J',12:'Q',13:'K'})[c.r]||String(c.r),suit={S:'♠',H:'♥',D:'♦',C:'♣'}[c.s];return [...root.querySelectorAll('.playing-card')].find(n=>!n.disabled&&n.getAttribute('aria-label')===rank+' '+suit);}
function box(group,x,y,z,w,h,d,color,click){const o=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color,roughness:.4}));o.position.set(x,y,z);o.userData={owned:true,click};group.add(o);return o;}
export function stopModel(expectedHost=null){if(!active||expectedHost&&active.host!==expectedHost)return;clearInterval(active.clockTick);active.cancelHold?.();active.observer.disconnect();disposeDynamic(active.dynamic);active.scene.environment?.dispose();active.renderer.dispose();active.renderer.forceContextLoss();active=null;}
export async function updateModel(room,gameRoot){
 const host=document.getElementById('model-stage');if(!host)return;
 if(!active||active.host!==host){stopModel();let renderer;try{renderer=new T.WebGLRenderer({antialias:true,alpha:false});}catch{host.textContent='3D is unavailable in this browser. The complete game controls are below.';return;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor('#091a20');renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;host.replaceChildren(renderer.domElement);renderer.domElement.setAttribute('aria-label','3D game view; equivalent keyboard controls below');
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,1,.01,100),dynamic=new T.Group();scene.add(new T.HemisphereLight(0xddeeff,0x2b1e12,2.2));const key=new T.DirectionalLight(0xffead0,3);key.position.set(2,5,3);scene.add(key);const fill=new T.DirectionalLight(0xb7d6ff,2);fill.position.set(-3,2,-2);scene.add(fill);scene.add(dynamic);
 if(isPokerGame(room.game)){
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:15});key.shadow.bias=-.0003;
  // Large studio light panels provide real reflections in the polished metal.
  const studio=new T.Scene();studio.background=new T.Color('#353c48');
  for(const [x,y,z,w,h] of [[0,5,1,7,3],[-4,2,0,2,5],[4,3,-2,3,4]]){
   const panel=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide}));panel.position.set(x,y,z);panel.lookAt(0,0,0);studio.add(panel);
  }
  const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(studio,.06).texture;pmrem.dispose();studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
 }
 active={host,renderer,scene,camera,dynamic,model:null,name:null,token:0,room:null,root:null,templates:{}};
 const state=active;state.cancelHold=attachTableHold(renderer.domElement,()=>isPokerGame(state.room?.game));state.render=()=>{if(!host.isConnected)return;const w=host.clientWidth||800,h=isPokerGame(state.room?.game)?(host.clientHeight||360):Math.min(560,Math.max(300,w*.55));renderer.setSize(w,h,false);camera.aspect=w/h;
 if(isPokerGame(state.room?.game)){const portrait=w<=800;if(state.portrait!==undefined&&state.portrait!==portrait){state.portrait=portrait;updateModel(state.room,state.root);return;}camera.zoom=1.25*(portrait?Math.min(2*w/h,1.45):Math.min(w/h*.83,1.85));}
 else if(state.room?.game?.startsWith('battleship')&&state.model){
  const bounds=new T.Box3().setFromObject(state.model).union(new T.Box3().setFromObject(dynamic)),points=[];
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new T.Vector3(x,y,z));
  const fit=fitCameraToPoints(camera,points);host.dataset.fleetFitExtent=String(fit.extent);host.dataset.fleetCameraZoom=String(fit.zoom);
 }
 camera.updateProjectionMatrix();renderer.render(scene,camera);
 for(const entry of state.seatLabels||[]){const v=entry.point.clone().project(camera);const padX=entry.node.offsetWidth/2+8,padY=entry.node.offsetHeight/2+8;entry.node.style.left=Math.max(padX,Math.min(w-padX,(v.x*.5+.5)*w))+'px';entry.node.style.top=Math.max(padY+(entry.node.querySelector('.poker-avatar')?.offsetHeight||24),Math.min(h-padY-42,(-v.y*.5+.5)*h))+'px';}};state.observer=new ResizeObserver(state.render);state.observer.observe(host);
 renderer.domElement.addEventListener('click',e=>{if(Number(host.closest('.game-window')?.dataset.inputBlockedUntil||0)>performance.now())return;const r=renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hits=ray.intersectObjects(dynamic.children,true);for(const hit of hits){let o=hit.object;while(o&&!o.userData.click)o=o.parent;if(o?.userData.click){const b=o.userData.click;if(b.isConnected&&!b.disabled)b.click();break;}}});
 }
 const a=active;clearInterval(a.clockTick);a.room=room;a.root=gameRoot;const name=models[room.game];
 if(a.name!==name){const token=++a.token;a.name=name;if(a.model)a.scene.remove(a.model);a.model=null;disposeDynamic(a.dynamic);
 try{const gltf=await load(name);if(active!==a||token!==a.token)return;a.model=gltf.scene.clone(true);a.scene.add(a.model);a.templates={};
  if(name.startsWith('NLHE'))a.model.traverse(o=>{if(o.isMesh&&o.material?.name==='Imperial emerald felt'){o.material=o.material.clone();o.userData.tableFelt=true;}if(/^Seat.*(cushion|pedestal|foot|backrest)/i.test(o.name))o.visible=false;});
   if(name==='Chess'){a.model.traverse(o=>{const key=chessModelTemplateKey(o);if(key){if(!a.templates[key])a.templates[key]=o.clone(true);o.visible=false;}});}
  if(name==='Fleet_Command'){
   a.model.traverse(o=>{if(/Fleet_ship|Ship_superstructure|Ship_turret|Gun_barrel/.test(o.name))o.visible=false;});
   const library=await load('Fleet_Ships_6');if(active!==a||token!==a.token)return;
   library.scene.traverse(o=>{if(o.name.startsWith('Ship_'))a.templates[o.name.slice(5)]=o.clone(true);});
  }
  // Remove static sample piles: gameplay cards and chips come from the authorized view only.
  if(name.startsWith('Rummy'))a.model.traverse(o=>{if(/Stock_card|Discard_card/.test(o.name))o.visible=false;});
 }catch(error){if(active===a)host.textContent='3D model could not load. Use the game controls below.';return;}}
 if(!a.model)return;
 room=a.room;gameRoot=a.root;const s=room.state;disposeDynamic(a.dynamic);
 a.host.querySelector('.poker-seat-labels')?.remove();a.seatLabels=[];
 if(isPokerGame(room.game)){
  a.model.traverse(o=>{
   if(/^Game[ _]label$/.test(o.name))o.visible=!s.variant||s.variant==='holdem';
   if(/^Community[ _]card[ _]slot/.test(o.name))o.visible=!['stud5','draw5','progressive_draw','triple27'].includes(s.variant);
   if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}
   if(o.userData.tableFelt){o.material.color.set(skins[preferences().skin].color);o.material.roughness=1;o.material.metalness=0;}
   if(o.isMesh&&(/^Padded[ _]perimeter[ _]rail$/.test(o.name)||o.material?.name==='Brushed brass')){
    if(!o.userData.rimOriginal){o.userData.rimOriginal=o.material;o.material=o.material.clone();}
    if(preferences().skin==='blackgold'){o.material.color.set('#efb94e');o.material.metalness=.94;o.material.roughness=.17;o.material.envMapIntensity=1.3;}
    else{o.material.copy(o.userData.rimOriginal);}
   }
  });
  const options=document.createElement('button');options.className='poker-table-options';options.textContent='Table options';options.onclick=openTableOptions;a.host.querySelector('.poker-table-options')?.remove();a.host.append(options);
  const overlay=document.createElement('div');overlay.className='poker-seat-labels';a.host.append(overlay);
  a.portrait=a.host.clientWidth<=800;
  a.model.rotation.y=a.portrait?Math.PI/2:0;
  a.model.updateMatrixWorld(true);
  room.seats.forEach((seat,i)=>{
   const anchor=a.model.getObjectByName('Seat_'+String((Math.max(0,room.seat)-i+(a.portrait?Math.round(room.seats.length*.75):0)+room.seats.length)%room.seats.length).padStart(2,'0'));if(!anchor)return;
   const point=anchor.getWorldPosition(new T.Vector3());point.x*=.94;point.z*=.94;
   const node=document.createElement('button');node.type='button';node.setAttribute('aria-label','View profile: '+seat.name);node.className='poker-seat-label'+(i===room.seat?' is-you':'')+(i===s.turn&&!s.over&&s.phase!=='round'?' is-turn':'')+(s.folded[i]?' is-folded':'');
   const name=document.createElement('strong');name.textContent=seat.name+(i===room.seat?' · YOU':'');name.title=name.textContent;
   const chips=document.createElement('span');chips.textContent=formatChips(s.stacks[i],s);
   const bet=document.createElement('small');bet.textContent=(i===s.dealer?'D · ':'')+(s.folded[i]?'Folded':s.stacks[i]===0?'All-in · '+formatChips(s.bets[i],s):'Bet '+formatChips(s.bets[i],s));
   const avatar=document.createElement('img');avatar.className='poker-avatar';avatar.src='/pvp3d-avatars/player-'+(i%9+1)+'.svg';avatar.alt='Placeholder avatar';avatar.width=44;avatar.height=44;
   node.append(avatar,name,chips,bet);
   if(node.classList.contains('is-turn')&&room.turnClock){
    const clock=room.turnClock,received=performance.now();const countdown=document.createElement('small');countdown.className='poker-turn-seconds';node.append(countdown);
    const tick=()=>{const left=Math.max(0,clock.deadline-clock.serverNow-(performance.now()-received));node.style.setProperty('--turn-left',(left/clock.duration*100)+'%');countdown.textContent=Math.ceil(left/1000)+'s';};tick();a.clockTick=setInterval(tick,100);
   }
   node.addEventListener('click',()=>{
    document.querySelector('.poker-profile-dialog')?.remove();
    const dialog=document.createElement('dialog');dialog.className='poker-profile-dialog';
    const title=document.createElement('h2');title.textContent=seat.name;
    const portrait=avatar.cloneNode();portrait.width=80;portrait.height=80;
    const detail=document.createElement('p');detail.textContent='Seat '+(i+1)+' · '+formatChips(s.stacks[i],s)+' · '+(s.folded[i]?'Folded':s.stacks[i]===0?'All-in':'In the hand');
    const note=document.createElement('p');note.textContent='Mock profile picture · local practice';
    const close=document.createElement('button');close.textContent='Close profile';close.onclick=()=>dialog.close();
    const header=document.createElement('header');header.className='profile-player-header';
    const identity=document.createElement('div');identity.className='profile-player-identity';identity.append(title,detail);
    const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='profile-header-close';dismiss.textContent='×';dismiss.setAttribute('aria-label','Close player profile');dismiss.onclick=()=>dialog.close();
    header.append(portrait,identity,dismiss);
    const body=document.createElement('div');body.className='profile-player-body';body.append(profileStats(),profileReactions(),note,close);
    dialog.append(header,body);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();node.focus({preventScroll:true});});dialog.showModal();
   });
   overlay.append(node);a.seatLabels.push({node,point});
  });
 }

 if(room.game==='chess'){
   a.camera.position.set(0,.78,.69);a.camera.lookAt(0,.02,0);const buttons=[...gameRoot.querySelectorAll('.board-square')];let renderedPieces=0;
  for(let i=0;i<64;i++){const x=(i%8-3.5)*.063,z=(Math.floor(i/8)-3.5)*.063,p=s.board[i],button=buttons[i];
   const hit=box(a.dynamic,x,.067,z,.062,.002,.062,button?.classList.contains('chosen')?0xc4a144:button?.getAttribute('aria-label').includes('legal destination')?0x42885e:(Math.floor(i/8)+i%8)%2?0x17282b:0xe5dec9,button);
    if(p){const template=a.templates[p.color+p.type.toUpperCase()];if(template){const piece=template.clone(true);piece.visible=true;piece.position.set(x,.066,z);piece.userData.click=button;a.dynamic.add(piece);renderedPieces++;}}
   }a.host.dataset.chessPieceCount=String(renderedPieces);
  }else if(room.game.startsWith('battleship')){
  a.camera.position.set(0,2.0,1.65);a.camera.lookAt(0,0,0);const me=room.seat>=0?room.seat:0,buttons=[...gameRoot.querySelectorAll('.sea-cell')];
  const grids=[...gameRoot.querySelectorAll('.fleet-grid')];
  for(let side=0;side<2;side++){const cx=side===0?-.63:.63,p=side===0?me:1-me,shots=s.shots[1-p],targets=[...grids[side]?.querySelectorAll('.sea-cell')||[]];
   for(let i=0;i<100;i++){const x=cx+(i%10-4.5)*.1,z=(Math.floor(i/10)-4.5)*.1,hit=shots[i],o=box(a.dynamic,x,.104,z,.095,.004,.095,hit==='hit'?0x9f2736:hit==='miss'?0x276b8e:0x133d53,targets[i]);if(hit){const mark=label(hit==='hit'?'×':'•',hit==='hit'?'#ffba7a':'#d3e9ef');mark.scale.set(.25,.5,1);mark.position.set(x,.11,z);mark.userData.click=targets[i];a.dynamic.add(mark);}}
   // Opponent fleets exist here only if server projection has revealed them.
   for(const ship of (s.ships[p]?.length?s.ships[p]:s.sunk?.[p])||[]){if(!ship.cells.length)continue;const xs=ship.cells.map(i=>cx+(i%10-4.5)*.1),zs=ship.cells.map(i=>(Math.floor(i/10)-4.5)*.1),x=xs.reduce((a,b)=>a+b)/xs.length,z=zs.reduce((a,b)=>a+b)/zs.length,vertical=xs.every(v=>v===xs[0]),L=ship.cells.length*.095;
    const template=a.templates[ship.name];
    if(template){const model=template.clone(true);model.position.set(x,.111,z);model.rotation.y=vertical?Math.PI/2:0;a.dynamic.add(model);}
    for(const i of ship.cells)if(shots[i]==='hit'){
      const mark=label('×','#ff773c');mark.scale.set(.23,.46,1);mark.position.set(cx+(i%10-4.5)*.1,.265,(Math.floor(i/10)-4.5)*.1);a.dynamic.add(mark);
    }
   }
  }
 }else{
  if(isPokerGame(room.game)){a.camera.position.set(0,5.8,a.portrait?4.3:3.2);a.camera.lookAt(0,.5,0);}else{a.camera.position.set(0,3.6,3.8);a.camera.lookAt(0,.5,0);}
  const p=room.seat,hand=s.hands?.[p]||[];
  if(isPokerGame(room.game)){
   for(let seat=0;seat<room.seats.length;seat++){
    if(s.folded[seat])continue;
    const anchor=a.model.getObjectByName('Hand_'+String((Math.max(0,p)-seat+(a.portrait?Math.round(room.seats.length*.75):0)+room.seats.length)%room.seats.length).padStart(2,'0'));if(!anchor)continue;
    const point=anchor.getWorldPosition(new T.Vector3()),cards=s.hands?.[seat];
    const count=s.handCounts?.[seat]??cards?.length??s.holeCards??2;
    for(let i=0;i<count;i++)addCard(a.dynamic,cards?.[i]||{},point.x+(i-(count-1)/2)*(count>2?.105:.135),point.z,null,!cards?.[i],point.y+.018);
   }
  }else{
   hand.forEach((c,i)=>addCard(a.dynamic,c,(i-(hand.length-1)/2)*.075,.38,buttonCard(gameRoot,c)));
   for(let seat=0;seat<(s.handCounts?.length||0);seat++)if(seat!==p&&seat<room.seats.length){const t=-Math.PI/2+seat*Math.PI*2/room.seats.length,x=Math.cos(t)*1.0,z=-Math.sin(t)*.46;for(let i=0;i<Math.min(s.handCounts[seat],2);i++)addCard(a.dynamic,s.hands?.[seat]?.[i]||{},x+i*.07,z,null,!s.hands?.[seat]);}
  }
  (s.board||[]).forEach((c,i)=>addCard(a.dynamic,c,(i-2)*.135,.05));
  (s.trick||[]).forEach(({card:c},i)=>addCard(a.dynamic,c,(i-1.5)*.08,.05));
  if(s.discard?.length)addCard(a.dynamic,s.discard.at(-1),.13,.21);
  if(s.stockCount){addCard(a.dynamic,{},-.13,.21,null,true);}
  if(s.melds)s.melds.forEach((m,j)=>m.cards.forEach((c,i)=>addCard(a.dynamic,c,-.65+(j%4)*.35+i*.065,-.15-Math.floor(j/4)*.11)));
  if(['blackjack','baccarat'].includes(room.game))(s.hands[1]||[s.dealerUpcard].filter(Boolean)).forEach((c,i)=>addCard(a.dynamic,c,(i-.5)*.08,-.25));
  if(room.game==='blackjack'&&s.phase==='play')addCard(a.dynamic,{},.12,-.25,null,true);
  if(s.wheel!==undefined){const result=label('BALL '+s.wheel);result.position.set(.55,.87,.08);a.dynamic.add(result);}
  if(s.dice){const result=label(s.dice.join(' + '));result.position.set(0,.90,.18);a.dynamic.add(result);}
 }
 a.render();
}
