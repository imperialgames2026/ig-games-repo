import React,{useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '@/lib/AuthContext';
import {supabase} from '@/lib/supabaseClient';
import {createSmsConsentClient} from '@/lib/smsConsentClient';
import {SMS_CONSENT_VERSION,normalizeSmsPhone} from '@/lib/smsConsentPolicy.mjs';
import SmsConsentFields from '@/components/auth/SmsConsentFields';
export default function SmsConsent(){
 const {user,isLoadingAuth}=useAuth();
 const [phone,setPhone]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(null),[message,setMessage]=useState('');
 const client=useRef(null),lock=useRef(false),epoch=useRef(0);
 if(!client.current||client.current.actor!==user?.id){client.current={actor:user?.id,api:createSmsConsentClient(body=>supabase.functions.invoke('sms-consent',{body}))};epoch.current++;}
 const api=client.current.api;
 useEffect(()=>{setPhone('');setConsent(false);setStatus(null);setMessage('');let mounted=true;const n=++epoch.current;if(user?.id&&!isLoadingAuth)api.status().then(s=>{if(mounted&&epoch.current===n)setStatus(s);}).catch(e=>{if(mounted&&epoch.current===n)setMessage(e.message);});return()=>{mounted=false;};},[user?.id,isLoadingAuth]);
 async function save(action){if(lock.current||isLoadingAuth||!user?.id)return;const n=++epoch.current;lock.current=true;setBusy(true);setMessage('');try{
  const payload=action==='grant'?{action,phone:normalizeSmsPhone(phone),affirmative:consent,policyVersion:SMS_CONSENT_VERSION}:{action,policyVersion:SMS_CONSENT_VERSION};
  if(action==='grant'&&!consent)throw Error('Check the optional consent box to save this preference.');
  const result=await api.save(payload);if(epoch.current!==n)return;setStatus(result);setPhone('');setConsent(false);setMessage('Preference recorded. SMS delivery remains disabled.');
 }catch(e){if(epoch.current===n)setMessage(e.message);}finally{lock.current=false;setBusy(false);}}
 return <main className="mx-auto max-w-xl space-y-4 p-6 text-white"><h1 className="text-2xl font-bold">SMS preferences</h1><p>Consent does not verify ownership of a number or enable SMS delivery. No texts are sent here.</p><p>Recorded preference: {status?.status||'not confirmed'}</p><SmsConsentFields phone={phone} onPhone={setPhone} consent={consent} onConsent={setConsent} disabled={busy||isLoadingAuth||api.hasPending()}/><button disabled={busy} onClick={()=>save('grant')}>Save optional consent / retry</button><button disabled={busy} onClick={()=>save('revoke')}>Withdraw consent</button><button disabled={busy} onClick={()=>save('change_number')}>Invalidate previous number</button><p role="status">{message}</p><Link to="/">Continue without SMS</Link></main>;
}
