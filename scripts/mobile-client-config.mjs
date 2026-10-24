import { pathToFileURL } from 'node:url';

export const PRACTICE_BACKEND = 'https://qonqemhljgxlwpghkxhn.supabase.co';
export const PRACTICE_PROJECT = 'qonqemhljgxlwpghkxhn';

// Never log credential values. Client configuration does not replace RLS.
export function validateMobileClient(env) {
  if (env.VITE_SUPABASE_URL !== PRACTICE_BACKEND) throw new Error('Android build requires the reviewed practice backend.');
  if (env.VITE_ENABLE_LEGACY_EDGE_FUNCTIONS === 'true') throw new Error('Legacy operations must remain disabled.');
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!key) throw new Error('A public Supabase publishable/anon key is required.');
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key)) return { kind: 'publishable' };
  try {
    const parts = key.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.role === 'anon' && payload.ref === PRACTICE_PROJECT) return { kind: 'anon' };
  } catch { /* Reject without displaying credentials. */ }
  throw new Error('Only a client publishable key or matching anon JWT is allowed; server keys are forbidden.');
}

export async function loadMobileEnvironment() {
  const { loadEnv } = await import('vite');
  const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
  validateMobileClient(env);
  return env;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const env = await loadMobileEnvironment();
    console.log(`Reviewed mobile client configuration accepted (${validateMobileClient(env).kind}); no credential printed.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
