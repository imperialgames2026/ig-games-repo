// Shared browser/server policy. Consent records never authorize delivery by themselves.
export const SMS_CONSENT_VERSION = '2026-10-27.v1';
export const SMS_CONSENT_PURPOSE = 'transactional_account';
export const SMS_CONSENT_DISCLOSURE = 'I agree to receive transactional account-security text messages from Imperial Gaming at the number I provide, including verification codes and account-security alerts, if SMS service becomes available. Message frequency varies. Message and data rates may apply. This is optional and is not required to create an email account. SMS delivery is currently disabled. I can withdraw consent in SMS preferences. This does not consent to marketing messages.';
export const SMS_POLICY_LINKS = Object.freeze({ terms: '/TermsOfService', privacy: '/PrivacyPolicy' });
export const SMS_DELIVERY_ENABLED = false;
export function normalizeSmsPhone(value) {
  if (typeof value !== 'string' || !/^\+[1-9][0-9]{7,14}$/.test(value.trim())) throw new Error('Enter an international phone number beginning with + and country code.');
  return value.trim();
}
export function consentRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid consent request');
  const allowed = new Set(['action', 'requestId', 'phone', 'policyVersion', 'affirmative', 'expectedRevision']);
  if (Object.keys(input).some(key => !allowed.has(key))) throw new Error('Unknown consent field');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.requestId || '')) throw new Error('Consent request ID required');
  if (!['grant', 'revoke', 'change_number'].includes(input.action)) throw new Error('Unknown consent action');
  if (input.action === 'grant' && input.policyVersion !== SMS_CONSENT_VERSION) throw new Error('Review the current SMS disclosure');
  if (input.action === 'grant' && (!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)) throw new Error('Current consent revision required');
  if (input.action !== 'grant' && input.expectedRevision != null) throw new Error('Withdrawal does not require a revision');
  if (input.action === 'grant' && input.affirmative !== true) throw new Error('Explicit SMS consent required');
  if (input.action !== 'grant' && input.affirmative === true) throw new Error('Number changes and revocation cannot grant consent');
  if (input.action !== 'grant' && input.phone != null && input.phone !== '') throw new Error('Revocation does not require a phone number');
  return Object.freeze({ action: input.action, requestId: input.requestId, policyVersion: SMS_CONSENT_VERSION, phone: input.action !== 'grant' ? null : normalizeSmsPhone(input.phone), affirmative: input.action === 'grant', expectedRevision: input.action === 'grant' ? input.expectedRevision : null });
}
export function assertSmsDeliveryDisabled() {
  const error = new Error('SMS delivery is not enabled. No text message was requested.');
  error.code = 'SMS_DELIVERY_DISABLED';
  throw error;
}
