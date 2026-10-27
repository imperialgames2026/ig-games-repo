// Source-only actual local HTTP adapter, constructed without making a request.
export function createManualCashoutAttempt({origin,anon}){
 if(origin!=='http://127.0.0.1:54321'||typeof anon!=='string'||!anon)throw Error('exact approved local gateway required');
 return async(user,slug,body)=>{
  if(process.env.IG_SYNTHETIC_STACK_APPROVED!=='1'||user?.phase!=='payout'||typeof user.token!=='string'||!user.token||slug!=='ig-crash-v2'||body?.action!=='cashout')throw Error('approved real payout identity/cashout required');
  const r=await fetch(origin+'/functions/v1/ig-crash-v2',{method:'POST',headers:{apikey:anon,authorization:'Bearer '+user.token,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  return {status:r.status,body:await r.json()};
 };
}
