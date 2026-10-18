import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
const key='imperial-poker-open-tables';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const get=()=>{try{return JSON.parse(sessionStorage.getItem(key)||'[]').filter(x=>uuid.test(x)).slice(0,3)}catch{return []}};
export default function PokerMultiTable(){
 const [tables,setTables]=useState(get),[entry,setEntry]=useState(''),[error,setError]=useState('');
 useEffect(()=>{sessionStorage.setItem(key,JSON.stringify(tables));},[tables]);
 const add=()=>{const id=entry.trim();if(!uuid.test(id)){setError('Enter a valid table UUID from your Hold’em table link');return;}
 if(tables.includes(id)){setError('That table is already open');return;}
 if(tables.length>=3){setError('Only three concurrent table views are supported');return;}
 setTables(v=>[...v,id]);setEntry('');setError('');};
 return <main className="min-h-screen bg-[#0a0612] px-3 py-6 text-white"><div className="mx-auto max-w-[1800px] space-y-5">
  <div><Link to="/PlayPoker" className="text-amber-300">← Poker lobby</Link><h1 className="mt-2 text-3xl font-black">My multi-table Hold’em desk</h1><p className="mt-2 text-sm text-gray-300">View and play up to three independent signed-in practice tables side by side. Each table maintains its own server state, seat and action timer.</p></div>
  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/20 bg-[#1c1729] p-4">
   <input aria-label="Table ID" className="min-w-52 flex-1 rounded-lg border border-white/25 bg-[#0a0612] px-4 py-3" placeholder="Paste a Hold’em table UUID" value={entry} onChange={e=>setEntry(e.target.value)}/>
   <button type="button" onClick={add} disabled={tables.length>=3} className="rounded-lg bg-amber-400 px-5 py-3 font-black text-black disabled:opacity-50">+ Add table ({tables.length}/3)</button>
   {error&&<span role="alert" className="w-full text-red-300">{error}</span>}
  </div>
  {tables.length===0&&<p className="rounded-xl border border-white/15 p-8 text-center text-gray-300">Open a Hold’em room and copy its table ID to add it here.</p>}
  <div className={'grid gap-4 '+(tables.length===1?'grid-cols-1':tables.length===2?'lg:grid-cols-2':'xl:grid-cols-3')}>
   {tables.map((id,index)=><section key={id} className="min-w-0 overflow-hidden rounded-xl border border-amber-300/35 bg-[#161324]">
    <div className="flex items-center justify-between gap-2 border-b border-white/10 p-3 text-sm"><strong>Table {index+1} · {id.slice(0,8)}</strong>
     <div className="flex gap-3"><a href={'/PlayPoker?tableId='+encodeURIComponent(id)} target="_blank" rel="noopener noreferrer" className="text-amber-300 underline">Full screen</a>
      <button type="button" onClick={()=>setTables(t=>t.filter(x=>x!==id))} className="text-red-300">Remove</button></div>
    </div>
    <iframe title={'Poker table '+(index+1)} src={'/PlayPoker?tableId='+encodeURIComponent(id)} className="h-[900px] w-full border-0" loading="eager"/>
   </section>)}
  </div>
  <p className="text-xs text-amber-200">Staging practice only. This desk does not buy seats automatically, create extra balances, bypass table limits or enable real currency. Each view is an independent game session.</p>
 </div></main>;
}
