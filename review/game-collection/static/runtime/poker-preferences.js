const key='imperial-poker-table-options';
export const skins={blackgold:{label:"Black felt · polished gold",color:"#090b0c"},emerald:{label:'Imperial emerald',color:'#13836b'},royal:{label:'Royal purple',color:'#633c88'},midnight:{label:'Midnight blue',color:'#20476b'},burgundy:{label:'Burgundy',color:'#7c2944'}};
export function preferences(){try{const p=JSON.parse(localStorage.getItem(key)||'{}');return {skin:skins[p.skin]?p.skin:'emerald',units:p.units==='bb'?'bb':'chips'};}catch{return {skin:'emerald',units:'chips'};}}
export function unitScale(state){return preferences().units==='bb'?state.bigBlind:1;}
export function formatChips(value,state){return (value/unitScale(state)).toLocaleString(undefined,{maximumFractionDigits:2})+(preferences().units==='bb'?' BB':' chips');}
export function openTableOptions(){
 if(document.querySelector('.poker-options-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='poker-profile-dialog poker-options-dialog';
 const title=document.createElement('h2');title.textContent='Table options';dialog.append(title);
 const saved=preferences();
 for(const [field,label,choices] of [['skin','Table skin',Object.entries(skins).map(([value,s])=>[value,s.label])],['units','Bet and stack display',[['chips','Chips'],['bb','Big blinds (BB)']]]]){
  const row=document.createElement('label');row.textContent=label;const select=document.createElement('select');select.setAttribute('aria-label',label);
  for(const [value,text] of choices){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}select.value=saved[field];
  select.onchange=()=>{const next={...preferences(),[field]:select.value};try{localStorage.setItem(key,JSON.stringify(next));}catch{}window.dispatchEvent(new Event('poker-options-change'));};row.append(select);dialog.append(row);
 }
 const note=document.createElement('p');note.textContent='Your view only. BB uses the current big blind. Preview skins are available in local practice.';dialog.append(note);
 const close=document.createElement('button');close.textContent='Done';close.onclick=()=>dialog.close();dialog.append(close);
 dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
}
export function attachTableHold(canvas,isPoker){
 let timer=null,start=null,suppress=false;
 const cancel=()=>{clearTimeout(timer);timer=null;start=null;};
 canvas.addEventListener('pointerdown',e=>{if(!isPoker()||e.button!==0)return;cancel();suppress=false;start={x:e.clientX,y:e.clientY};timer=setTimeout(()=>{cancel();suppress=true;openTableOptions();},650);});
 canvas.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>12)cancel();});
 for(const event of ['pointerup','pointercancel','pointerleave','lostpointercapture'])canvas.addEventListener(event,cancel);
 canvas.addEventListener('contextmenu',e=>{if(isPoker())e.preventDefault();});
 canvas.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();suppress=false;}},true);
 return cancel;
}
