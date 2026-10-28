import React from 'react';
import { Link } from 'react-router-dom';
import { SMS_CONSENT_DISCLOSURE, SMS_CONSENT_VERSION } from '@/lib/smsConsentPolicy.mjs';
export default function SmsConsentFields({phone,onPhone,consent,onConsent,disabled=false}){
 return <fieldset disabled={disabled} className="min-w-0 space-y-3 rounded-lg border border-white/15 p-3"><legend>Optional SMS preferences</legend>
 <p className="text-sm text-slate-300">SMS delivery is disabled. Email registration works without SMS consent.</p>
 <label className="block min-w-0 text-sm">Mobile number (optional)<input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e=>{onPhone(e.target.value);onConsent(false);}} placeholder="+15555550123" maxLength={16} className="mt-1 min-h-11 w-full min-w-0 rounded bg-slate-950 p-2 text-base" /></label>
 <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm"><input type="checkbox" checked={consent} onChange={e=>onConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0"/><span className="min-w-0 break-words">{SMS_CONSENT_DISCLOSURE}</span></label>
 <p className="text-xs text-slate-400">Disclosure version {SMS_CONSENT_VERSION}. <Link className="underline" to="/TermsOfService">Terms of Service</Link> · <Link className="underline" to="/PrivacyPolicy">Privacy Policy</Link></p>
 </fieldset>;
}
