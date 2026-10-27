export const functions = Object.freeze(['poker-table-v1','poker-events-v1','admin-poker-events','ig-blackjack-practice','ig-multiplayer-practice','ig-shared-event-practice','ig-crash-v2']);
export function route(raw, method) {
 if(!['GET','POST','PATCH','DELETE','OPTIONS'].includes(method))return null;
 if(typeof raw!=='string'||!raw.startsWith('/')||raw.startsWith('//')||/[\\\x00-\x20]/.test(raw)||/%(?:2e|2f|5c)/i.test(raw))return null;
 const u=new URL(raw,'http://gateway.invalid');
 if(u.pathname.split('/').includes('..')||raw.includes('/../'))return null;
 for(const [prefix,host,port]of[['/auth/v1/','auth',9999],['/rest/v1/','rest',3000],['/functions/v1/','edge',9000]]){
  if(!u.pathname.startsWith(prefix))continue;
  const tail=u.pathname.slice(prefix.length);
  if(host==='edge'&&!functions.includes(tail)&&tail!=='health')return null;
  return {host,port,path:'/'+tail+u.search};
 }return null;
}
export function fixturePlan(run,phase="browser"){
 if(!["browser","lifecycle","payout","tournament"].includes(phase))throw Error("invalid phase");
 if(!/^[a-f0-9]{32}$/.test(run))throw Error('invalid run');
 const aliases=phase==='tournament'?['player-a','player-b','player-c','player-d','player-e','player-f','player-g','player-h','player-i','excluded','tester','admin']:['player-a','player-b','excluded','tester','admin'];
 return aliases.map(kind=>({kind,phase,email:`${kind}-${phase}-${run}@example.invalid`,metadata:{full_name:`Synthetic ${kind}`},canonicalRole:kind==='admin'?'superadmin':kind==='tester'?'tester':'player',excluded:kind==='excluded'}));
}
export function assertLocal(origin){if(!['http://127.0.0.1:54321','http://127.0.0.1:4173'].includes(origin))throw Error('nonlocal target');return origin;}
