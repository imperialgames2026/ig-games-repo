import React,{useState} from 'react';
import {savedTableCommitment,verifyTableRound} from '@/lib/tableFairness';

export default function TableFairnessPanel({state,game}) {
 const [selected,setSelected]=useState(''),[message,setMessage]=useState(null),[busy,setBusy]=useState(false);
 const history=state?.fairnessHistory||[],proof=history.find(p=>String(p.round)===selected)||history[0];
 async function verify(){
  if(!proof)return;setBusy(true);
  try{const result=await verifyTableRound(proof,savedTableCommitment(game,proof.round));
   setMessage({round:proof.round,text:result.preflightVerified?
    `Round #${proof.round}: the saved pre-deal commitment and reconstructed outcome match.`:
    `Round #${proof.round}: the seed and reconstructed outcome match. This device did not save a pre-deal commitment, so the original lock cannot be verified.`});
  }catch(error){setMessage({round:proof.round,text:error.message});}finally{setBusy(false);}
 }
 return <section aria-label="Table fairness verification" className="rounded-xl border border-amber-300/30 bg-[#1b1727] p-5 text-sm space-y-3">
  <h2 className="text-lg font-black text-white">Verify the fairness</h2>
  <p className="text-gray-300">The server commits to a secret seed before the deal or roll. After the round, your device reconstructs the shuffled cards or result and checks it against the commitment and observations saved here.</p>
  {state?.fairness?<p className="break-all text-xs text-amber-100">Current round #{state.round} commitment: {state.fairness.serverSeedHash}</p>:
   <p className="text-amber-200">{state?'This hand began before proof tracking was available. Verification starts with the next committed round.':'Connect to the table to receive its commitment.'}</p>}
  {proof?<>
   <label className="block">Completed round
    <select aria-label="Fairness round" value={String(proof.round)} onChange={e=>{setSelected(e.target.value);setMessage(null);}} className="block w-full mt-1 rounded bg-gray-900 border border-gray-600 p-2">
     {history.map(p=><option key={p.round} value={p.round}>Round #{p.round}</option>)}
    </select>
   </label>
   <button disabled={busy} onClick={()=>void verify()} className="rounded-lg border border-amber-300 px-4 py-2 font-bold text-amber-200 disabled:opacity-50">{busy?'Checking…':'Verify selected round'}</button>
   {message?.round===proof.round&&<p role="status" className="text-amber-100">{message.text}</p>}
   <details><summary className="cursor-pointer text-amber-200">Seeds and reproducible proof</summary><textarea aria-label="Reproducible table proof" readOnly value={JSON.stringify(proof,null,2)} className="mt-2 h-48 w-full rounded bg-black/30 p-2 text-xs"/></details>
  </>:<p className="text-gray-400">Complete a committed round to reveal its proof. Future cards and seeds stay hidden during play.</p>}
  <p className="text-xs text-gray-400">A matching proof verifies the committed sequence. It does not independently audit the server operator or guarantee a win.</p>
 </section>;
}
