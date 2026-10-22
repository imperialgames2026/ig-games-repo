import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import {deflateSync} from 'node:zlib';
const c=JSON.parse(readFileSync('/tmp/ig-local-runtime.json','utf8'));
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(c.API_URL))throw Error('KYC tests require isolated local Supabase');
const service=createClient(c.API_URL,c.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
function crc(b){let n=0xffffffff;for(const v of b){n^=v;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
function chunk(type,b){const out=Buffer.alloc(b.length+12);out.writeUInt32BE(b.length);out.write(type,4);b.copy(out,8);out.writeUInt32BE(crc(out.subarray(4,-4)),out.length-4);return out;}
function png(){const h=Buffer.alloc(13);h.writeUInt32BE(240);h.writeUInt32BE(240,4);h[8]=8;h[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(Buffer.alloc((240*3+1)*240,0))),chunk('IEND',Buffer.alloc(0))]);}
async function account(role='player'){
 const email='kyc-'+crypto.randomUUID()+'@example.invalid',password='Local-'+crypto.randomUUID()+'-A8!';
 const r=await service.auth.admin.createUser({email,password,email_confirm:true});expect(r.error).toBeNull();
 if(role!=='player')expect((await service.from('user_roles').update({role}).eq('user_id',r.data.user.id)).error).toBeNull();
 const client=createClient(c.API_URL,c.ANON_KEY,{auth:{persistSession:false}});const login=await client.auth.signInWithPassword({email,password});expect(login.error).toBeNull();return {...r.data.user,email,password,client,token:login.data.session.access_token};
}
async function login(page,u){await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(u.email);await page.getByLabel('Password',{exact:true}).fill(u.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).not.toHaveURL(/\/login$/);}
async function call(u,action,payload={}){const response=await fetch(c.API_URL+'/functions/v1/ig-kyc-v1',{method:'POST',headers:{apikey:c.ANON_KEY,Authorization:'Bearer '+u.token,'content-type':'application/json'},body:JSON.stringify({action,...payload})});return {status:response.status,data:await response.json()};}
test('private KYC upload, independent reviewer, advisory queue, audit and retention use real local services',async({page})=>{
 test.setTimeout(120000);const user=await account(),other=await account(),admin=await account('admin');
 const wallet=await service.from('wallets').select('*').eq('user_id',user.id).single();expect(wallet.error).toBeNull();
 await login(page,user);await page.goto('/KYCVerification');await page.getByLabel('Full legal name',{exact:true}).fill('Synthetic Identity');await page.getByLabel('Date of birth',{exact:true}).fill('1990-01-01');await page.getByLabel('Issuing country code').fill('US');await page.getByLabel(/I consent to Imperial Games/).check();await page.getByLabel(/I also consent/).check();await page.getByRole('button',{name:'Create private submission'}).click();
 await expect(page.getByRole('heading',{name:'Add identity images'})).toBeVisible();
 for(const label of ['ID front or passport photo page','Your selfie'])await page.getByLabel(label,{exact:true}).setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:png()});
 await page.getByRole('button',{name:'Submit for human review'}).click();await expect(page.getByRole('status')).toContainText('submitted for human review');
 const mine=await call(user,'mine');expect(mine.status).toBe(200);const id=mine.data.result[0].id;
 expect((await call(other,'detail',{id})).status).toBe(404);expect((await call(user,'detail',{id})).status).toBe(403);expect((await call(user,'queue')).status).toBe(403);
 expect((await user.client.rpc('ig_kyc_action',{p_actor:admin.id,p_action:'queue',p_payload:{}})).error).toBeTruthy();
 expect((await user.client.from('ig_kyc_submissions').select('*')).error).toBeTruthy();
 expect((await user.client.storage.from('ig-kyc-evidence').download(`${user.id}/${id}/id_front`)).error).toBeTruthy();
 expect((await call(user,'submit',{id,evidence:{fake:true}})).status).toBe(400);
 const workerToken=randomBytes(32).toString('hex');expect((await service.from('ig_kyc_workers').insert({token_hash:createHash('sha256').update(workerToken).digest('hex'),name:'local-synthetic-worker',expires_at:new Date(Date.now()+3600000).toISOString()})).error).toBeNull();
 async function worker(action,payload={},token=workerToken){const r=await fetch(c.API_URL+'/functions/v1/ig-kyc-v1',{method:'POST',headers:{apikey:c.ANON_KEY,Authorization:'Bearer '+c.ANON_KEY,'x-kyc-worker-token':token,'content-type':'application/json'},body:JSON.stringify({action,...payload})});return {status:r.status,data:await r.json()};}
 expect((await worker('worker_claim',{},'0'.repeat(64))).status).toBe(403);
 const claim=await worker('worker_claim');expect(claim.status).toBe(200);expect(claim.data.job.id).toBe(id);
 expect((await worker('worker_claim')).data.job).toBeNull();
 const finish={id,lease:claim.data.job.lease,result:{status:'manual_review_required'}};expect((await worker('worker_finish',finish)).status).toBe(200);expect((await worker('worker_finish',finish)).status).toBe(409);
 const d=await call(admin,'detail',{id});expect(d.data.result.face_result.status).toBe('manual_review_required');expect(d.data.result.evidence.id_front.path).toBeUndefined();
 const approved={id,revision:d.data.result.revision,outcome:'approved',reason:'Synthetic independent verification fixture',customer_message:'Synthetic approval',checks:{}};
 expect((await call(admin,'review',approved)).status).toBe(422);
 await page.context().clearCookies();await page.evaluate(()=>localStorage.clear());await login(page,admin);await page.goto('/AdminKYC');await page.getByRole('button',{name:new RegExp(user.id.slice(0,8))}).click();await expect(page.getByRole('heading',{name:'Synthetic Identity'})).toBeVisible();
 await page.getByRole('button',{name:'Open id front for 60 seconds'}).click();await expect(page.getByAltText('Submitted identity document')).toBeVisible();
 for(const text of ['Document authenticity independently checked','Document portrait and selfie manually matched','Date of birth and applicable age requirement checked','Independent liveness evidence reviewed'])await page.getByLabel(text,{exact:true}).check();
 await page.getByLabel('Decision',{exact:true}).selectOption('approved');await page.getByLabel('Internal review reason').fill('Synthetic independent verification fixture');await page.getByLabel('Message to the customer').fill('Synthetic approval');await page.getByRole('button',{name:'Save audited decision'}).click();await expect(page.getByRole('heading',{name:'Human review decision'})).toHaveCount(0);
 expect((await service.from('profiles').select('kyc_status').eq('id',user.id).single()).data.kyc_status).toBe('approved');
 expect((await service.from('wallets').select('*').eq('user_id',user.id).single()).data).toEqual(wallet.data);
 expect((await call(admin,'review',{...approved,checks:{document_authenticity:true,selfie_match:true,age_review:true,liveness_review:true}})).status).toBe(422);
 expect((await service.from('ig_kyc_submissions').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('id',id)).error).toBeNull();
 expect((await call(admin,'evidence',{id,kind:'id_front'})).status).toBe(403);expect((await worker('worker_purged',{id})).status).toBe(200);
 const erased=await service.from('ig_kyc_submissions').select('full_name,evidence,face_result,evidence_deleted_at').eq('id',id).single();expect(erased.data.full_name).toBe('Deleted');expect(erased.data.evidence).toEqual({});expect(erased.data.face_result).toBeNull();expect(erased.data.evidence_deleted_at).toBeTruthy();
 expect((await service.storage.from('ig-kyc-evidence').download(`${user.id}/${id}/id_front`)).error).toBeTruthy();
});
