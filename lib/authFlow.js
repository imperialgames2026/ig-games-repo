// UI routing and messages only. Supabase Auth and canonical roles authorize requests.
export function safeReturnPath(destination) {
  const path = destination?.pathname;
  if (typeof path !== 'string' || !/^\/(?!\/)/.test(path) || /[\\\r\n]/.test(path)) return '/';
  const search = typeof destination.search === 'string' && destination.search.startsWith('?') ? destination.search : '';
  const hash = typeof destination.hash === 'string' && destination.hash.startsWith('#') ? destination.hash : '';
  return `${path}${search}${hash}`;
}

export function readAuthLinkError(location) {
  const query = new URLSearchParams(location.search);
  const fragment = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  const failed = [query, fragment].some(params => ['error', 'error_code', 'error_description'].some(key => params.has(key)));
  // Never render provider-supplied URL text, which can contain arbitrary content.
  return failed ? 'This email link is invalid, expired or already used. Request a new link below.' : null;
}

export function clearAuthLinkErrorUrl(browser) {
  const url = new URL(browser.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  for (const key of ['error', 'error_code', 'error_description']) {
    url.searchParams.delete(key);
    hash.delete(key);
  }
  if (readAuthLinkError(browser.location)) {
    url.hash = hash.toString();
    browser.history.replaceState(browser.history.state, '', url.pathname + url.search + url.hash);
  }
}
