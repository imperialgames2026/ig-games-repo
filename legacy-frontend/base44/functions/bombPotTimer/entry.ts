import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Scheduled function — checks all active tables and triggers bomb pot when timer elapses.
// Should be run on a schedule (every 5 minutes).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tables = await base44.asServiceRole.entities.SitAndGoTable.filter({
      bomb_pot_enabled: true,
      status: 'active'
    });

    const now = new Date();
    const triggered = [];

    for (const table of tables) {
      if (table.bomb_pot_active) continue; // already in a bomb pot hand

      const lastAt = table.last_bomb_pot_at ? new Date(table.last_bomb_pot_at) : null;
      const triggerMs = (table.bomb_pot_trigger_minutes || 7) * 60 * 1000;
      const elapsed = lastAt ? (now - lastAt) : Infinity;

      if (elapsed >= triggerMs) {
        // Trigger the bomb pot: move fund to pot, mark active, reset fund, record time
        await base44.asServiceRole.entities.SitAndGoTable.update(table.id, {
          bomb_pot_active: true,
          pot: (table.pot || 0) + (table.bomb_pot_fund || 0),
          bomb_pot_fund: 0,
          last_bomb_pot_at: now.toISOString()
        });

        console.log(`Bomb pot triggered on table "${table.name}" — fund of ${table.bomb_pot_fund} ID moved to pot.`);
        triggered.push(table.name);
      }
    }

    return Response.json({ triggered, checked: tables.length });
  } catch (error) {
    console.error('bombPotTimer error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});