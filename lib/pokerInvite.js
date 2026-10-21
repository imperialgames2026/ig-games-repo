import { isPokerId } from './pokerTableView.js';

// Interpret an invite as an internal destination. Never navigate to the pasted URL.
export function parsePokerInvite(value, selectedVariant = 'holdem') {
  const input = typeof value === 'string' ? value.trim() : '';
  const variant = selectedVariant === 'omaha' ? 'omaha' : 'holdem';
  if (!input) return null;
  if (isPokerId(input)) return room(input, variant, false);
  try {
    const url = new URL(input, 'https://imperialgaming.llc');
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    const path = url.pathname.replace(/\/$/, '');
    if (!['/PlayPoker', '/PlayOmaha'].includes(path) || url.searchParams.getAll('tableId').length !== 1) return null;
    const id = url.searchParams.get('tableId');
    return isPokerId(id) ? room(id, path === '/PlayOmaha' ? 'omaha' : 'holdem', true) : null;
  } catch {
    return null;
  }
}

function room(tableId, variant, fromLink) {
  const id = tableId.toLowerCase();
  return { tableId: id, variant, fromLink, destination: `${variant === 'omaha' ? '/PlayOmaha' : '/PlayPoker'}?tableId=${encodeURIComponent(id)}` };
}
