import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ ok: false }, { status: 401 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';
    const userAgent = req.headers.get('user-agent') || '';

    // Passive geo lookup via free IP API
    let location = '';
    try {
      const geo = await fetch(`https://ipapi.co/${ip}/json/`);
      if (geo.ok) {
        const gd = await geo.json();
        if (gd.city && gd.country_name) {
          location = `${gd.city}, ${gd.country_name}`;
        } else if (gd.country_name) {
          location = gd.country_name;
        }
      }
    } catch (_) { /* silent */ }

    const now = new Date().toISOString();

    // Read current user record
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const existing = existingUsers[0];

    const blockedRegions = ['washington', 'idaho'];
    const normalizedLocation = (location || '').toLowerCase();
    const isBlockedRegion = blockedRegions.some(region => normalizedLocation.includes(region));

    if (isBlockedRegion) {
      return Response.json({
        ok: false,
        blocked: true,
        reason: 'restricted_region',
        message: 'Access is not available in Washington or Idaho.'
      }, { status: 403 });
    }

    const updateData = {
      last_ip: ip,
      last_location: location,
      last_user_agent: userAgent,
      last_seen_at: now,
    };

    // Store registration IP if not yet set
    if (!existing?.registration_ip) {
      updateData.registration_ip = ip;
      updateData.registration_location = location;
    }

    // Append to ip_history (keep last 20)
    const history = existing?.ip_history || [];
    const lastEntry = history[history.length - 1];
    if (!lastEntry || lastEntry.ip !== ip) {
      history.push({ ip, location, ts: now });
      if (history.length > 20) history.shift();
      updateData.ip_history = history;
    }

    await base44.auth.updateMe(updateData);

    return Response.json({ ok: true });
  } catch (error) {
    console.error('trackSession error:', error.message);
    return Response.json({ ok: false }, { status: 500 });
  }
});