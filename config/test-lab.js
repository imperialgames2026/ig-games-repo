// Confirmed by the owner: Supabase project "IG network lab tests".
// Keep this separate from the historical staging deployment manifest.
export const LAB_PROJECT_REF = 'jvyzpxjqmymafjapprpp';
export const LAB_SUPABASE_URL = `https://${LAB_PROJECT_REF}.supabase.co`;

export function validateLabConfiguration(environment) {
  if (environment.VITE_SUPABASE_URL !== LAB_SUPABASE_URL) {
    throw new Error(`Set VITE_SUPABASE_URL=${LAB_SUPABASE_URL} in .env.lab.local or the hosting environment. The lab build cannot use another project.`);
  }
  const key = environment.VITE_SUPABASE_PUBLISHABLE_KEY || environment.VITE_SUPABASE_ANON_KEY;
  if (!key || !key.trim() || /placeholder|your[_-]?key/i.test(key)) {
    throw new Error('Set the lab project’s public publishable key in VITE_SUPABASE_PUBLISHABLE_KEY. Use environment settings or ignored .env.lab.local; never use a service-role key.');
  }
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return;
  try {
    const segments = key.split('.');
    if (segments.length !== 3) throw new Error('Malformed public key');
    const payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString());
    if (payload.role === 'anon' && payload.ref === LAB_PROJECT_REF) return;
  } catch { /* Invalid public-key shape fails closed below. */ }
  throw new Error('The lab needs its own public publishable/anon key. Secret, service-role and other-project keys cannot be bundled in the site.');
}
