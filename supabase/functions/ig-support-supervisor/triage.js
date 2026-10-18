// Conservative support triage rules. This module runs without an AI key.
export const SUPPORT_CATEGORIES=['account','payments','kyc','technical','gaming','responsible_play','security','other'];
export function redactSupportText(input=''){
 return String(input)
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email removed]')
  .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g,'[phone/number removed]')
  .replace(/\b(?:0x[a-f0-9]{40}|(?:bc1|ltc1)[a-z0-9]{20,}|[a-zA-Z0-9]{50,})\b/gi,'[address removed]')
  .slice(0,1200);
}
export function classifySupportByRules(subject='',message=''){
 const s=(subject+' '+message).toLowerCase();
 const patterns=[
  {re:/suicid|self[- ]?harm|harm myself|gambling (addict|problem)|can't stop gambling|self[- ]?exclu|responsible play/i,cat:'responsible_play',reason:'Player safety or responsible gaming concern'},
  {re:/fraud|identity theft|hacked|stolen|account takeover|compromised|sanction|money launder|suspicious|unauthori[sz]ed/i,cat:'security',reason:'Security or compliance concern'},
  {re:/withdraw|payout|cash ?out|refund|chargeback|dispute|deposit missing|missing deposit|payment failed|payment stuck|frozen funds|reversal|funds stuck/i,cat:'payments',reason:'Financial or payment decision may require approval'},
  {re:/kyc|identity verification|verification fail|document reject|account restricted|banned|suspended|age verific|compliance|regulator|legal notice/i,cat:'kyc',reason:'Identity, account restriction or legal concern'},
 ];
 const match=patterns.find(p=>p.re.test(s));
 return {category:match?.cat||(/error|crash|bug|login|broken|failed to load/i.test(s)?'technical':/poker|craps|roulette|game|betting/i.test(s)?'gaming':'account'),
  priority:match?'high':'normal',requires_superadmin:Boolean(match),
  reason:match?.reason||'Routine case; staff review required',suggested_reply:null,
  classification_source:'rules'};
}
