// Supabase owns factor secrets, code verification and rate limits. These checks
// control the UI; database policies and Edge Functions enforce the same boundary.
export async function requireCompletedMfa(client, verifiedUser) {
  if (!verifiedUser.factors?.some(factor => factor.status === 'verified')) return;
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  if (data?.currentLevel !== 'aal2') {
    const required = new Error('Enter your authenticator code to finish signing in.');
    required.type = 'mfa_required';
    throw required;
  }
}

export async function verifiedAuthenticators(client) {
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.totp || []).filter(factor => factor.status === 'verified');
}

export async function verifyAuthenticator(client, factorId, code) {
  if (!factorId || !/^\d{6}$/.test(code)) throw new Error('Enter the six-digit code from your authenticator app.');
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw error;
}

export function authenticatorError(error) {
  if (error?.status === 429 || /rate_limit|too_many/.test(error?.code || '')) return 'Too many attempts. Wait a moment before trying again.';
  if (/verification_failed|challenge_expired/.test(error?.code || '')) return 'That code is invalid or expired. Enter the current code from your authenticator app.';
  return 'Could not complete verification. Check your current code and connection, then try again.';
}
