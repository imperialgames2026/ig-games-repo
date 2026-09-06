import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  try {
    const auth = req.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const functionName = String(body?.functionName || '').trim();
    const payload = body?.payload ?? {};
    if (!/^[A-Za-z0-9_-]+$/.test(functionName)) return Response.json({ error: 'Invalid function name' }, { status: 400 });
    if (functionName === 'api' || functionName === 'legacy-entity') return Response.json({ error: 'Function not allowed through dispatcher' }, { status: 400 });
    const response = await fetch(`${url}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth, apikey: serviceKey },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return Response.json(data, { status: response.status });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
});
