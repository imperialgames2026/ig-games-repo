// Test-only observer. Never forwards requests or records headers/credentials.
export async function isLegacyProbeRequest(request) {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (request.method !== 'POST' || pathname !== '/functions/v1/api') return false;
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))?.functionName === 'legacyReadProbe';
  } catch {
    return false;
  }
}
