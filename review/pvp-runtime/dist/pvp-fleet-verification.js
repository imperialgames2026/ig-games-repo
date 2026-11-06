import {createFleetVerifier} from './fleet-verification.js';
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const fleet = view => ['battleship','battleship6'].includes(view?.game);
export function createPvpFleetVerifier(storage=null) {
 const actors=new Map();
 const forActor=id=>{
  if(!actors.has(id)) {
   const scoped=storage?{getItem:key=>storage.getItem('imperial-pvp-fleet-actor-v1:'+id+':'+key),setItem:(key,value)=>storage.setItem('imperial-pvp-fleet-actor-v1:'+id+':'+key,value)}:null;
   actors.set(id,createFleetVerifier(scoped));
  }
  return actors.get(id);
 };
 return {
  observe(snapshot,expectedActor) {
   if(snapshot?.protocol!=='ig.pvp.snapshot.v1'||!uuid(expectedActor)||snapshot.viewerId!==expectedActor||
    snapshot.financialExecutionEnabled!==false||!uuid(snapshot.roomId)||snapshot.view?.id!==snapshot.roomId||
    !Number.isSafeInteger(snapshot.revision)||snapshot.revision<1||snapshot.view?.version!==snapshot.revision||!fleet(snapshot.view)) return null;
   const room={...snapshot.view,fleetViewerId:expectedActor};
   forActor(expectedActor).observe(room);
   return room;
  },
  async verify(room) {
   if(!fleet(room)||!uuid(room.id)||!uuid(room.fleetViewerId))throw Error('Not verified: authenticated room/viewer context is unavailable.');
   return forActor(room.fleetViewerId).verify(room);
  }
 };
}
let storage=null;try{if(typeof window!=='undefined')storage=window.localStorage;}catch{}
export const pvpFleetVerifier=createPvpFleetVerifier(storage);
