// Resource bookkeeping; no startup or shell invocation. Docker adapter is supplied
// only by a future explicitly approved runtime driver.
export class Resources{
 constructor(run){if(!/^[a-f0-9]{32}$/.test(run))throw Error('invalid run');this.run=run;this.records=[];}
 register(kind,id){if(!['container','network'].includes(kind)||!/^[a-f0-9]{64}$/.test(id))throw Error('invalid exact resource');if(this.records.some(r=>r.id===id))throw Error('duplicate resource');this.records.push({kind,id});}
 async cleanup(docker){const failures=[];for(const r of [...this.records].reverse()){
  try{const metadata=await docker(['inspect',r.id]);const x=JSON.parse(metadata)[0];const labels=r.kind==='container'?x.Config?.Labels:x.Labels;if(x.Id!==r.id||labels?.['ig.synthetic.run']!==this.run)throw Error('resource ownership mismatch');await docker(r.kind==='container'?['rm','-f',r.id]:['network','rm',r.id]);this.records=this.records.filter(t=>t.id!==r.id);}catch{failures.push(r);}
 }return {removed:this.records.length===0,failures};}
}
export function runtimePlan(run){if(!/^[a-f0-9]{32}$/.test(run))throw Error('invalid run');return {run,prefix:'ig-practice-'+run,stage:'/tmp/ig-practice-'+run,ports:['127.0.0.1:54321:8000','127.0.0.1:4173'],containerMemoryMiB:2432,parallelBrowserWorkers:1,pullPolicy:'never',noHostDatabasePort:true,requiredApproval:true,ready:false};}
