// Store only the actor-bound public move intent and its original request ID.
// Never persist snapshots, private hands, fleet positions, tokens or server state.
export function pvpPending(storage,actor){
 const key='ig.pvp.pending.v1:'+actor;
 return {read(){const raw=storage.getItem(key);if(!raw)return null;const saved=JSON.parse(raw);if(saved.schema!==1||saved.actor!==actor||typeof saved.encoded!=='string'||saved.encoded.length>16384||!saved.body||typeof saved.body.requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(saved.body.requestId))throw Error('Invalid saved practice move');const {requestId:_requestId,...payload}=saved.body;if(JSON.stringify(payload)!==saved.encoded)throw Error('Saved practice move changed');return {encoded:saved.encoded,body:saved.body};},write(value){if(value)storage.setItem(key,JSON.stringify({schema:1,actor,...value}));else storage.removeItem(key);}};
}
