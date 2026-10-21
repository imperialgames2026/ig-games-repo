import { readFileSync } from 'node:fs';
import { LAB_PROJECT_REF, validateLabConfiguration } from './test-lab.js';

// These are public browser settings, never Supabase account or server credentials.
export function resolveTestLabHostingEnvironment(environment, hosting = process.env, publicConfiguration) {
  if (hosting.CF_PAGES_BRANCH !== 'test' && hosting.VERCEL_GIT_COMMIT_REF !== 'test') return environment;
  const configuration = publicConfiguration ?? JSON.parse(readFileSync(new URL('./test-lab-public.json', import.meta.url), 'utf8'));
  if (configuration.project_ref !== LAB_PROJECT_REF) throw new Error('Hosted test previews require the owner-selected lab project.');
  const resolved = {
    ...environment,
    VITE_SUPABASE_URL: configuration.supabase_url,
    VITE_SUPABASE_PUBLISHABLE_KEY: configuration.publishable_key,
    VITE_SUPABASE_ANON_KEY: configuration.publishable_key,
  };
  validateLabConfiguration(resolved);
  return resolved;
}
