// REVIEW ONLY. Import/construction never invokes Docker or starts any process.
import {spawn} from 'node:child_process';
const HEX=/^[a-f0-9]{64}$/;
export function checkContainer(x,{run,id,image}){
 if(!x||x.Id!==id||x.Image!==image||x.Name!==`/ig-practice-${run}-db`||x.State?.Running!==true||x.Config?.Labels?.['ig.synthetic.run']!==run)throw Error('SQL container ownership/image mismatch');
 if(Object.keys(x.HostConfig?.PortBindings??{}).length||x.HostConfig?.Privileged||x.HostConfig?.Binds?.length||!Object.hasOwn(x.HostConfig?.Tmpfs??{},'/var/lib/postgresql/data')||x.Mounts?.some(m=>m.Type!=='tmpfs'))throw Error('SQL container is not ephemeral/private');
 const networks=Object.keys(x.NetworkSettings?.Networks??{});
 if(networks.length!==1||networks[0]!==`ig-practice-${run}-private`)throw Error('SQL container network mismatch');
}
export function overlap(rows){
 if(rows.length<2)throw Error('two actual sessions required');
 for(const r of rows)if(!Number.isSafeInteger(r.pid)||!/^\d+$/.test(r.xid)||!Number.isSafeInteger(r.startUs)||!Number.isSafeInteger(r.readyUs)||r.startUs>=r.readyUs)throw Error('invalid PostgreSQL markers');
 if(new Set(rows.map(r=>r.pid)).size!==rows.length||new Set(rows.map(r=>r.xid)).size!==rows.length||Math.max(...rows.map(r=>r.startUs))>=Math.min(...rows.map(r=>r.readyUs)))throw Error('actual PostgreSQL transaction overlap not established');
}
export function markers(output){
 const find=p=>output.split('\n').filter(x=>x.startsWith(p)).map(x=>JSON.parse(x.slice(p.length)));
 const a=find('IG_START:'),b=find('IG_READY:');if(a.length!==1||b.length!==1||a[0].pid!==b[0].pid||a[0].xid!==b[0].xid)throw Error('missing/inconsistent server markers');
 return {pid:a[0].pid,xid:a[0].xid,startUs:a[0].us,readyUs:b[0].us};
}
export function createContainerSql({run,id,image,approvedRun,spawnImpl=spawn}){
 if(!/^[a-f0-9]{32}$/.test(run)||!HEX.test(id)||!/^sha256:[a-f0-9]{64}$/.test(image))throw Error('invalid exact SQL resource');
 const gate=()=>{if(approvedRun!==run||process.env.IG_SYNTHETIC_STACK_APPROVED!=='1')throw Error('explicit runtime/test approval required');};
 const exec=(args,input='')=>new Promise((resolve,reject)=>{
  let p,timer,settled=false,out='',err='',size=0;
  const finish=(error,value)=>{
   if(settled)return;settled=true;clearTimeout(timer);
   if(error){
    // Only this exact spawned child is stopped. Retain error listeners so a
    // late EPIPE/error/close cannot escape or settle the promise again.
    try{p?.stdin?.destroy();}catch{}
    try{if(p&&p.exitCode==null&&!p.killed)p.kill('SIGKILL');}catch{}
    reject(error);
   }else resolve(value);
  };
  try{p=spawnImpl('docker',args,{stdio:['pipe','pipe','pipe'],shell:false});}catch(error){finish(error);return;}
  const capture=(target,data)=>{
   if(settled)return;size+=data.length;
   if(size>2*1024*1024){finish(Error('SQL output limit'));return;}
   if(target==='out')out+=data;else err+=data;
  };
  // Register all asynchronous error handlers before writing to stdin.
  p.on('error',error=>finish(error));
  p.stdin.on('error',error=>finish(error));
  p.stdout.on('error',error=>finish(error));p.stderr.on('error',error=>finish(error));
  p.stdout.on('data',data=>capture('out',data));p.stderr.on('data',data=>capture('err',data));
  p.on('close',code=>finish(null,{code,out,err}));
  timer=setTimeout(()=>finish(Error('bounded SQL provider timeout')),25000);
  try{p.stdin.end(input);}catch(error){finish(error);}
 });
 const result=async text=>{
  gate();if(typeof text!=='string'||text.length>1024*1024)throw Error('invalid SQL test source');
  const inspect=await exec(['inspect',id]);if(inspect.code!==0)throw Error('owned SQL container unavailable');checkContainer(JSON.parse(inspect.out)[0],{run,id,image});
  return exec(['exec','-i',id,'psql','-X','-w','-h','/var/run/postgresql','-p','5432','-U','postgres','-d','postgres','-Atq','-v','ON_ERROR_STOP=1','-v','VERBOSITY=terse'],"set statement_timeout='15s';set lock_timeout='10s';set idle_in_transaction_session_timeout='15s';"+text);
 };
 return {run,async result(text){return result(text);},async sql(text){const r=await result(text);if(r.code!==0)throw Error('SQL test failed: '+r.err.slice(0,300));return r.out.trim();},async race(name,scripts,expectedSuccess){
  if(scripts.length<2||scripts.length>4)throw Error('bounded race requires 2..4 sessions');
  const stamp=label=>`select '${label}:'||json_build_object('pid',pg_backend_pid(),'xid',pg_current_xact_id()::text,'us',(extract(epoch from clock_timestamp())*1000000)::bigint)::text;`;
  const rows=await Promise.all(scripts.map(async text=>{const r=await result('begin;'+stamp('IG_START')+'select pg_sleep(0.2);'+stamp('IG_READY')+text+';commit;');return {...markers(r.out),ok:r.code===0,error:r.code? r.err.slice(0,200):null};}));
  overlap(rows);if(rows.filter(r=>r.ok).length!==expectedSuccess)throw Error('unexpected race outcome: '+name);return {name,sessions:rows,actualServerOverlap:true};
 }};
}
