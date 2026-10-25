// Device witnesses are a bounded cache. The server ledger is a separate record.
export function saveDeviceProof(storage,key,value,namespace,limit=256) {
 const encoded=JSON.stringify(value);
 if(storage.getItem(key)===encoded)return;
 storage.setItem(key,encoded);
 const indexKey=namespace+':index';
 const previous=JSON.parse(storage.getItem(indexKey)||'[]');
 if(!Array.isArray(previous))throw Error('Invalid saved proof index');
 const keys=previous.filter(k=>typeof k==='string'&&k!==key);keys.push(key);
 const removed=keys.splice(0,Math.max(0,keys.length-limit));
 for(const expired of removed)storage.removeItem?.(expired);
 storage.setItem(indexKey,JSON.stringify(keys));
}
