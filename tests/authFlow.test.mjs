import test from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnPath, readAuthLinkError, clearAuthLinkErrorUrl } from '../lib/authFlow.js';

test('sign-in return paths preserve internal destinations and reject external paths', () => {
  assert.equal(safeReturnPath({pathname:'/PlayPoker',search:'?table=123',hash:'#seat'}),'/PlayPoker?table=123#seat');
  for (const pathname of ['https://example.invalid', '//example.invalid', '/\\example.invalid', '/\n/example.invalid', null]) {
    assert.equal(safeReturnPath({pathname}),'/');
  }
  assert.equal(safeReturnPath(undefined),'/');
});

test('expired and reused callbacks show a fixed message instead of arbitrary provider text', () => {
  for (const location of [
    {search:'?error_code=otp_expired',hash:''},
    {search:'',hash:'#error=access_denied&error_description=Untrusted%20instructions'},
  ]) {
    assert.match(readAuthLinkError(location), /invalid, expired or already used/);
    assert.doesNotMatch(readAuthLinkError(location), /Untrusted/);
  }
  assert.equal(readAuthLinkError({search:'?mode=recovery',hash:''}),null);
});

test('acknowledging an invalid link preserves unrelated navigation state', () => {
  let changed;
  const url = new URL('https://imperialgaming.llc/login?mode=recovery&error_code=otp_expired#section=account&error=access_denied');
  const browser = {location:url,history:{state:{usr:{from:'/Profile'}},replaceState:(state,_title,path)=>{changed={state,path};}}};
  clearAuthLinkErrorUrl(browser);
  assert.deepEqual(changed,{state:browser.history.state,path:'/login?mode=recovery#section=account'});
});
