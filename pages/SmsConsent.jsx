import React,{useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {useAuth} from '@/lib/AuthContext';
import {supabase} from '@/lib/supabaseClient';
import {createSmsConsentClient,createActorBoundSmsInvoker} from '@/lib/smsConsentClient';
import {SMS_CONSENT_VERSION,normalizeSmsPhone} from '@/lib/smsConsentPolicy.mjs';
import SmsConsentFields from '@/components/auth/SmsConsentFields';
export default function SmsConsent(){
 const {user,isLoadingAuth}=useAuth();const location=useLocation();
 const [phone,setPhone]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(null),[message,setMessage]=useState('');
 const client=useRef(null),lock=useRef(false),epoch=useRef(0);
 if(!client.current||client.current.actor!==user?.id){client.current={actor:user?.id,api:createSmsConsentClient(createActorBoundSmsInvoker(supabase,user?.id))};epoch.current++;}
 const api=client.current.api;
 useEffect(()=>{setPhone('');setConsent(false);setStatus(null);setMessage('');let mounted=true;const n=++epoch.current;if(user?.id&&!isLoadingAuth)api.status().then(s=>{if(mounted&&epoch.current===n)setStatus(s);}).catch(e=>{if(mounted&&epoch.current===n)setMessage(e.message);});return()=>{mounted=false;};},[user?.id,isLoadingAuth]);
 async function save(action){if(lock.current||isLoadingAuth||!user?.id)return;const n=++epoch.current;lock.current=true;setBusy(true);setMessage('');try{
  const payload=action==='grant'?{action,phone:normalizeSmsPhone(phone),affirmative:consent,policyVersion:SMS_CONSENT_VERSION}:{action,policyVersion:SMS_CONSENT_VERSION};
  if(action==='grant'&&!consent)throw Error('Check the optional consent box to save this preference.');
  const result=await api.save(payload);if(epoch.current!==n)return;setStatus(result);setPhone('');setConsent(false);setMessage('Preference recorded. SMS delivery remains disabled.');
 }catch(e){if(epoch.current===n)setMessage(e.message);}finally{lock.current=false;setBusy(false);}}
 return <section data-sms-consent-panel aria-labelledby="sms-consent-title" className="mx-auto my-8 w-full min-w-0 max-w-xl space-y-4 break-words rounded-xl bg-slate-950 p-4 pb-28 text-white sm:p-6 sm:pb-6"><h1 id="sms-consent-title" className="text-2xl font-bold">SMS preferences</h1>{new URLSearchParams(location.search).get('registration')==='consent-unconfirmed'&&<p role="status">Your email account was created, but SMS consent was not confirmed. No SMS is enabled.</p>}<p>Consent does not verify ownership of a number or enable SMS delivery. No texts are sent here.</p><p>Recorded preference: {status?.status||'not confirmed'}</p><SmsConsentFields phone={phone} onPhone={setPhone} consent={consent} onConsent={setConsent} disabled={busy||isLoadingAuth||api.hasPending()}/><button className="mr-3 min-h-11 rounded border border-slate-400 px-3 py-2 focus:outline focus:outline-2 focus:outline-amber-300 disabled:opacity-50" disabled={busy} onClick={()=>save('grant')}>Save optional consent / retry</button><button className="mr-3 min-h-11 rounded border border-slate-400 px-3 py-2 focus:outline focus:outline-2 focus:outline-amber-300 disabled:opacity-50" disabled={busy} onClick={()=>save('revoke')}>Withdraw consent</button><button className="mr-3 min-h-11 rounded border border-slate-400 px-3 py-2 focus:outline focus:outline-2 focus:outline-amber-300 disabled:opacity-50" disabled={busy} onClick={()=>save('change_number')}>Invalidate previous number</button><p role="status">{message}</p><Link className="block text-amber-300 underline" to="/">Continue without SMS</Link></section>;
}
