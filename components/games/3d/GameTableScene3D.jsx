// @ts-nocheck -- Three.js runtime objects are validated by build/lint/WebGL smoke; repo JS stubs are intentionally incomplete.
import React,{useEffect,useRef} from 'react';
import * as THREE from 'three';
import './game-table-3d.css';

const REDS=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const ROULETTE=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const qualityFor=w=>w<390?{ratio:1,segments:24,shadows:false}:w<700?{ratio:1.15,segments:32,shadows:false}:w<1100?{ratio:1.35,segments:40,shadows:true}:{ratio:1.6,segments:56,shadows:true};

function labelTexture(text){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=356;
 const c=canvas.getContext('2d');c.fillStyle='#f5f1e8';c.fillRect(0,0,256,356);c.strokeStyle='#c8b892';c.lineWidth=10;c.strokeRect(7,7,242,342);
 c.fillStyle='#151515';c.font='bold 48px system-ui';c.textAlign='left';c.fillText(String(text||'✦'),24,66);
 c.fillStyle='#991e2e';c.font='bold 82px serif';c.textAlign='center';c.fillText('♠',128,210);
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function chipTexture(value){
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const c=canvas.getContext('2d');
 c.fillStyle='#5b2c83';c.fillRect(0,0,128,128);c.strokeStyle='#f6e6b4';c.lineWidth=10;c.beginPath();c.arc(64,64,48,0,Math.PI*2);c.stroke();
 c.fillStyle='#fff';c.font='bold 36px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(String(value),64,66);
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function addChipStack(scene,{x=0,z=0,count=4,value=25,materials,textures,geometries}){
 const texture=chipTexture(value);textures.push(texture);
 const mat=new THREE.MeshStandardMaterial({map:texture,roughness:.55,metalness:.08});materials.push(mat);
 const geometry=new THREE.CylinderGeometry(.29,.29,.075,32);geometries.push(geometry);
 for(let i=0;i<count;i++){const chip=new THREE.Mesh(geometry,mat);chip.position.set(x,.06+i*.08,z);scene.add(chip);}
}

export default function GameTableScene3D({game='roulette',outcome=null,cards=[],seats=[],chipCount=0,label}){
 const host=useRef(null),live=useRef({game,outcome,cards,seats,chipCount});
 live.current={game,outcome,cards,seats,chipCount};
 useEffect(()=>{
  const root=host.current;if(!root)return;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#080d12');scene.fog=new THREE.Fog('#080d12',12,28);
  const camera=new THREE.PerspectiveCamera(38,1,.1,70);camera.position.set(0,8.4,10.8);camera.lookAt(0,0,0);
  let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch{return;}
  root.appendChild(renderer.domElement);
  const materials=[],textures=[],geometries=[];
  const mat=(color,roughness=.72,metalness=.05)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness});materials.push(m);return m;};
  const geo=g=>{geometries.push(g);return g;};
  const wood=mat('#4b2819',.45,.08),felt=mat('#07583f',.95,0),gold=mat('#c49a51',.3,.55),black=mat('#11161c',.6,.08),red=mat('#8f1f2c',.7,.04),ivory=mat('#eee9da',.75,0),purple=mat('#4b276b',.55,.08);
  const table=new THREE.Group();scene.add(table);
  const top=new THREE.Mesh(geo(new THREE.CapsuleGeometry(3.2,4.5,10,24)),felt);top.rotation.z=Math.PI/2;top.scale.set(1,.16,1.18);top.position.y=-.05;table.add(top);
  const rail=new THREE.Mesh(geo(new THREE.TorusGeometry(3.85,.25,16,64)),wood);rail.rotation.x=Math.PI/2;rail.scale.z=1.38;rail.position.y=.02;table.add(rail);
  const trim=new THREE.Mesh(geo(new THREE.TorusGeometry(3.55,.06,10,64)),gold);trim.rotation.x=Math.PI/2;trim.scale.z=1.38;trim.position.y=.14;table.add(trim);
  scene.add(new THREE.HemisphereLight(0xfff1d2,0x14211f,1.9));
  const key=new THREE.DirectionalLight(0xffe1ad,3.1);key.position.set(4,9,6);key.castShadow=true;scene.add(key);
  const rim=new THREE.PointLight(0x8b5cf6,18,20);rim.position.set(-5,4,-4);scene.add(rim);

  let wheel=null,ball=null,dice=[];
  const current=live.current,q=qualityFor(root.clientWidth||420);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,q.ratio));renderer.shadowMap.enabled=q.shadows;

  if(current.game==='roulette'){
   wheel=new THREE.Group();scene.add(wheel);wheel.position.set(-1.8,.28,0);
   wheel.add(new THREE.Mesh(geo(new THREE.CylinderGeometry(2.35,2.55,.34,q.segments)),wood));
   const ring=new THREE.Mesh(geo(new THREE.TorusGeometry(1.82,.33,12,74)),black);ring.rotation.x=Math.PI/2;ring.position.y=.25;wheel.add(ring);
   for(let i=0;i<37;i++){const a=i*Math.PI*2/37,color=ROULETTE[i]===0?felt:REDS.has(ROULETTE[i])?red:black;const box=new THREE.Mesh(geo(new THREE.BoxGeometry(.24,.07,.5)),color);box.position.set(Math.sin(a)*1.78,.36,Math.cos(a)*1.78);box.rotation.y=a;wheel.add(box);}
   const hub=new THREE.Mesh(geo(new THREE.CylinderGeometry(.28,.7,.7,q.segments)),gold);hub.position.y=.62;wheel.add(hub);
   ball=new THREE.Mesh(geo(new THREE.SphereGeometry(.09,16,12)),ivory);ball.position.set(0,.48,2.04);wheel.add(ball);
   addChipStack(scene,{x:2.1,z:1.2,count:5,value:25,materials,textures,geometries});addChipStack(scene,{x:2.7,z:.25,count:3,value:5,materials,textures,geometries});
  }else if(current.game==='craps'){
   for(let i=0;i<2;i++){const die=new THREE.Mesh(geo(new THREE.BoxGeometry(.72,.72,.72)),ivory);die.position.set(i?1:-1,.55,0);die.castShadow=true;scene.add(die);dice.push(die);}
   addChipStack(scene,{x:-2.8,z:1.45,count:6,value:25,materials,textures,geometries});addChipStack(scene,{x:2.7,z:1.5,count:4,value:10,materials,textures,geometries});
  }else{
   const source=(current.cards||[]).slice(0,5);
   for(let i=0;i<5;i++){const texture=labelTexture(source[i]||'✦');textures.push(texture);const m=new THREE.MeshStandardMaterial({map:texture,roughness:.7});materials.push(m);const card=new THREE.Mesh(geo(new THREE.PlaneGeometry(.78,1.08)),m);card.rotation.x=-Math.PI/2;card.position.set((i-2)*.92,.18,.05);scene.add(card);}
   const count=clamp((current.seats||[]).length||7,2,8);
   for(let i=0;i<count;i++){const a=Math.PI*.18+(Math.PI*1.64)*(i/Math.max(1,count-1)),x=Math.cos(a)*4.25,z=Math.sin(a)*3.25-1;const marker=new THREE.Mesh(geo(new THREE.CylinderGeometry(.42,.42,.14,24)),purple);marker.position.set(x,.15,z);scene.add(marker);addChipStack(scene,{x:x*.9,z:z*.9,count:2+(i%4),value:25,materials,textures,geometries});}
  }

  const observer=new ResizeObserver(()=>{const w=Math.max(1,root.clientWidth),h=Math.max(1,root.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();});observer.observe(root);
  const clock=new THREE.Clock();let frame=0,lastRound=null,start=0,visible=true;
  const visibility=()=>{visible=!document.hidden;};document.addEventListener('visibilitychange',visibility);
  const animate=()=>{frame=requestAnimationFrame(animate);if(!visible)return;const now=clock.getElapsedTime(),s=live.current,round=s.outcome?.round??s.outcome?.roundId??JSON.stringify(s.outcome||null);if(round!==lastRound){lastRound=round;start=now;}const t=clamp((now-start)/2.5,0,1),ease=1-Math.pow(1-t,3);
   if(wheel){const n=Number(s.outcome?.number??s.outcome?.values?.[0]),idx=ROULETTE.indexOf(n);wheel.rotation.y=(Number.isInteger(idx)&&idx>=0?-idx*Math.PI*2/37:0)+ease*Math.PI*8;if(ball){const a=(1-ease)*Math.PI*12;ball.position.set(Math.sin(a)*2.04,.48,Math.cos(a)*2.04);}}
   if(dice.length){const vals=s.outcome?.dice??s.outcome?.values??[1,1];dice.forEach((d,i)=>{const v=Number(vals[i]||1),air=(1-t)*Math.abs(Math.sin(t*Math.PI*6))*1.6;d.position.set((i?1:-1)*(1+(1-t)*2),.55+air,Math.sin(t*8+i)*(1-t));d.rotation.set((1-ease)*Math.PI*8+v*.5,(1-ease)*Math.PI*7+v*.25,(1-ease)*Math.PI*5+v*.35);});}
   table.rotation.y=Math.sin(now*.18)*.018;renderer.render(scene,camera);
  };animate();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());renderer.dispose();root.replaceChildren();};
 },[]);
 return <section className="ig-game-3d-shell" aria-label={label||`3D ${game} table presentation`}><div ref={host} className="ig-game-3d-canvas" role="img" aria-label={label||`3D ${game} table with chips and game equipment`}/><div className="ig-game-3d-badge">3D TABLE VIEW · PRESENTATION ONLY</div></section>;
}
