import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSmsPhone, consentRequest, SMS_CONSENT_VERSION as version, SMS_CONSENT_DISCLOSURE, SMS_DELIVERY_ENABLED, assertSmsDeliveryDisabled } from '../lib/smsConsentPolicy.mjs';
const base = { action: 'grant', requestId: '00000000-0000-4000-8000-000000000001', phone: '+12025550123', policyVersion: version, affirmative: true };
test('only explicit affirmative grant, current disclosure, strict phone accepted', () => {
 assert.equal(consentRequest(base).phone, '+12025550123');
 for (const affirmative of [false, undefined, 'true', 1]) assert.throws(() => consentRequest({ ...base, affirmative }));
 assert.throws(() => consentRequest({ ...base, policyVersion: 'old' }));
 for (const phone of ['2025550123', '+1 (202) 555-0123', '+02025550123', '+1', null, '+1202555012345678']) assert.throws(() => normalizeSmsPhone(phone));
 assert.equal(normalizeSmsPhone(' +12025550123 '), '+12025550123');
});
test('revoke without phone; number change never implicitly grants', () => {
 assert.equal(consentRequest({ ...base, action: 'revoke', phone: null, affirmative: false }).phone, null);
 assert.throws(() => consentRequest({ ...base, action: 'revoke' }));
 assert.equal(consentRequest({ ...base, action: 'revoke', phone: null, affirmative: false, policyVersion: 'old' }).action, 'revoke');
 assert.throws(() => consentRequest({ ...base, action: 'change_number' }));
 assert.equal(consentRequest({ ...base, action: 'change_number', phone:null, affirmative: false }).affirmative, false);
 assert.equal(consentRequest({ ...base, action: 'revoke',phone:null, affirmative:false, policyVersion:'old' }).action,'revoke');
});
test('request binding retained and caller actor/verification/delivery flags rejected', () => {
 assert.deepEqual(consentRequest(base), consentRequest(base));
 assert.notDeepEqual(consentRequest(base), consentRequest({ ...base, phone: '+12025550124' }));
 for (const key of ['actorId', 'phoneVerified', 'deliveryEnabled', 'purpose', 'createdAt']) assert.throws(() => consentRequest({ ...base, [key]: true }));
 assert.throws(() => consentRequest({ ...base, requestId: '' }));
});
test('delivery always disabled; disclosure makes no keyword-service claim', () => {
 assert.equal(SMS_DELIVERY_ENABLED, false);
 assert.throws(assertSmsDeliveryDisabled, { code: 'SMS_DELIVERY_DISABLED' });
 assert.doesNotMatch(SMS_CONSENT_DISCLOSURE, /STOP|HELP/);
 assert.match(SMS_CONSENT_DISCLOSURE, /optional/);
});
