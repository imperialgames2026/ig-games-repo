import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function buildBaseUsername(email) {
  return String(email || '').split('@')[0] || 'player';
}

function sanitizeUsername(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

async function getUniqueUsername(base44, desiredUsername, currentUserId = null) {
  const clean = sanitizeUsername(desiredUsername);
  const normalized = clean.toLowerCase();
  const users = await base44.asServiceRole.entities.User.list('-created_date', 10000);

  const taken = new Set(
    users
      .filter((u) => u.id !== currentUserId)
      .map((u) => String(u.username_normalized || '').toLowerCase())
      .filter(Boolean)
  );

  if (!taken.has(normalized)) {
    return { username: clean, username_normalized: normalized };
  }

  let counter = 2;
  while (taken.has(`${normalized}${counter}`)) {
    counter += 1;
  }

  return {
    username: `${clean}${counter}`,
    username_normalized: `${normalized}${counter}`,
  };
}

async function getNextAccountNumber(base44, currentUserId = null) {
  const users = await base44.asServiceRole.entities.User.list('-created_date', 10000);
  let maxAccountNumber = 19713;

  for (const user of users) {
    if (user.id === currentUserId) continue;
    const numericValue = Number(user.account_number);
    if (Number.isFinite(numericValue) && numericValue > maxAccountNumber) {
      maxAccountNumber = numericValue;
    }
  }

  return String(maxAccountNumber + 1);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = {};

    if (!user.account_number) {
      updates.account_number = await getNextAccountNumber(base44, user.id);
    }

    if (!user.username || !user.username_normalized) {
      const baseUsername = buildBaseUsername(user.email);
      const usernameData = await getUniqueUsername(base44, baseUsername, user.id);
      updates.username = usernameData.username;
      updates.username_normalized = usernameData.username_normalized;
    }

    if (Object.keys(updates).length > 0) {
      await base44.auth.updateMe(updates);
    }

    return Response.json({ ok: true, updates });
  } catch (error) {
    console.error('initializeUserIdentity error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});