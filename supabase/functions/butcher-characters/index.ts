import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { createCharacterHandler } from '../_shared/imperial-campaign/character-service.ts';

const LAB_URL = 'https://jvyzpxjqmymafjapprpp.supabase.co';
const url = Deno.env.get('SUPABASE_URL');
const publishable = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (url !== LAB_URL || !publishable || !serviceKey) {
  Deno.serve(() => new Response(JSON.stringify({ error: 'Butcher lab service is unavailable' }), {
    status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  }));
} else {
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const auth = createClient(url, publishable, options);
  const admin = createClient(url, serviceKey, options);
  Deno.serve(createCharacterHandler({
    async authenticate(token) {
      const { data, error } = await auth.auth.getUser(token);
      return error || !data.user ? null : { id: data.user.id, isAnonymous: data.user.is_anonymous };
    },
    async rpc(name, args) { return await admin.rpc(name, args); },
  }));
}
