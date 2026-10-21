import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { pagesConfig } from '@/pages.config';

const titles = {
  Home: 'Home', Games: 'Game library', PokerLobby: 'Poker lobby', Profile: 'Profile settings',
  TesterChips: 'How tester chips work', login: 'Sign in', ResetPassword: 'Reset your password',
  Support: 'Support center', ProfileStats: 'Player analytics', PastPlayedHands: 'Hand archive',
};

// Route announcements, focus and scroll restoration only. No activity is sent.
export default function NavigationTracker() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(null);
  const positions = useRef(new Map());

  useEffect(() => {
    const before = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = before; };
  }, []);

  useEffect(() => {
    const page = location.pathname.split('/')[1] || 'Home';
    const known = page.toLowerCase() === 'login' || Object.keys(pagesConfig.Pages).some(key => key.toLowerCase() === page.toLowerCase());
    const title = titles[page] || (known ? page.replace(/([a-z0-9])([A-Z])/g, '$1 $2') : 'Page not found');
    document.title = page === 'Home' ? 'Imperial Games | Tester-Chip Preview' : title + ' | Imperial Games';
    const changed = previousPath.current !== null && previousPath.current !== location.pathname;
    previousPath.current = location.pathname;
    const target = navigationType === 'POP' ? positions.current.get(location.key) || 0 : 0;
    let observer, timeout;
    if (changed) {
      const restore = () => {
        const heading = /** @type {HTMLElement | null} */ (document.querySelector('#page-content h1, main h1'));
        if (!heading) return false;
        if (navigationType !== 'POP') {
          heading.setAttribute('tabindex', '-1');
          heading.focus({ preventScroll: true });
        }
        window.scrollTo({ top: target, left: 0, behavior: 'instant' });
        return document.documentElement.scrollHeight >= target + window.innerHeight || target === 0;
      };
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (!restore()) {
        observer = new MutationObserver(() => { if (restore()) observer.disconnect(); });
        observer.observe(document.getElementById('root'), { childList: true, subtree: true });
        timeout = window.setTimeout(() => observer.disconnect(), 2000);
      }
    }
    const savePosition = () => {
      positions.current.set(location.key, window.scrollY);
      if (positions.current.size > 80) positions.current.delete(positions.current.keys().next().value);
    };
    window.addEventListener('scroll', savePosition, { passive: true });
    return () => {
      window.removeEventListener('scroll', savePosition);
      observer?.disconnect();
      window.clearTimeout(timeout);
    };
  }, [location.key, location.pathname, navigationType]);
  return null;
}
