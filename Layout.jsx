import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Gamepad2, Crown, Trophy, Headphones, UserRound, LogOut, Menu, X, BookOpen, ShieldCheck, Coins } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import PageTransition from '@/components/mobile/PageTransition';
import AnnouncementBanner from '@/components/casino/AnnouncementBanner';

const navigation = [
  { name: 'Home', icon: Home, page: 'Home' },
  { name: 'Games', icon: Gamepad2, page: 'Games' },
  { name: 'Poker', icon: Crown, page: 'PokerLobby' },
  { name: 'Practice board', icon: Trophy, page: 'Leaderboard' },
  { name: 'Support', icon: Headphones, page: 'Support' },
];
const legalLinks = [
  ['TermsOfService', 'Terms of service'], ['PrivacyPolicy', 'Privacy policy'],
  ['ResponsiblePlay', 'Responsible play'], ['FairnessManifesto', 'Fairness manifesto'],
  ['CookiesPolicy', 'Cookie policy'],
];

export default function Layout({ children, currentPageName }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const menuButton = useRef(null);
  const menuPanel = useRef(null);
  const isPlayPage = currentPageName?.startsWith('Play');

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    function dismiss(event) {
      if (event.type === 'keydown') {
        if (event.key !== 'Escape') return;
        setMenuOpen(false);
        menuButton.current?.focus();
      } else if (!menuPanel.current?.contains(event.target) && !menuButton.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', dismiss);
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', dismiss);
    };
  }, [menuOpen]);

  async function signOut() {
    setSigningOut(true);
    setError('');
    try { await logout(); }
    catch { setError('Sign-out could not finish. Please try again.'); setSigningOut(false); }
  }

  // The tables provide their own controls and should keep the full viewport.
  if (isPlayPage) return <>{children}</>;

  return <div className="min-h-screen bg-[#0A0612] text-white">
    <a href="#page-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-amber-300 focus:px-4 focus:py-3 focus:text-slate-950">Skip to content</a>
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0A0612]/95 backdrop-blur-xl" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4">
        <Link to="/" aria-label="Imperial Games home" className="flex min-w-0 items-center gap-2">
          <img src="/imperial-gaming.png" alt="" className="h-9 w-9 shrink-0 rounded-full object-cover sm:h-10 sm:w-10"/>
          <span className="truncate text-xs font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-pink-400 to-pink-300 min-[360px]:text-sm sm:text-base">IMPERIAL GAMES</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {navigation.map(({ name, icon: Icon, page }) => <Link key={page} to={'/' + page}
            aria-current={currentPageName === page ? 'page' : undefined}
            className={'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ' + (currentPageName === page ? 'bg-pink-600 text-white' : 'text-gray-300 hover:bg-white/10 hover:text-white')}>
            <Icon className="h-4 w-4" aria-hidden="true"/>{name}
          </Link>)}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {user ? <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" aria-label="Open account menu" className="min-h-11 gap-2 text-white hover:bg-white/10 hover:text-white">
              <UserRound className="h-5 w-5"/>
              <span className="hidden max-w-28 truncate sm:inline">{user.full_name || 'Account'}</span>
            </Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 border-white/15 bg-[#1A1528] text-white">
              <div className="px-2 py-3"><p className="truncate font-bold">{user.full_name || 'Player'}</p><p className="truncate text-xs text-gray-400">{user.email}</p></div>
              <DropdownMenuSeparator className="bg-white/10"/>
              {[
                ['Profile', 'Profile settings', UserRound], ['PastPlayedHands', 'Study your hands', BookOpen],
                ['ProfileStats', 'Player analytics', Trophy], ['TesterChips', 'About tester chips', Coins],
                ['ProvablyFair', 'Verify a round', ShieldCheck],
                ...(['admin', 'superadmin'].includes(user.role) ? [['Admin', 'Command center', ShieldCheck]] : []),
                ...(user.role === 'superadmin' ? [['PokerBotLab', 'Poker bot lab', Crown]] : []),
              ].map(([page, label, Icon]) => <DropdownMenuItem asChild key={page} className="cursor-pointer focus:bg-white/10 focus:text-white">
                <Link to={'/' + page} className="flex min-h-10 items-center gap-2"><Icon className="h-4 w-4"/>{label}</Link>
              </DropdownMenuItem>)}
              <DropdownMenuSeparator className="bg-white/10"/>
              <DropdownMenuItem disabled={signingOut} onClick={() => void signOut()} className="min-h-10 cursor-pointer text-pink-300 focus:bg-white/10 focus:text-pink-200"><LogOut className="mr-2 h-4 w-4"/>{signingOut ? 'Signing out…' : 'Sign out'}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu> : <Link to="/login" className="inline-flex min-h-11 items-center rounded-lg bg-pink-600 px-3 text-sm font-bold text-white hover:bg-pink-500 sm:px-4">Sign in</Link>}
          <Button ref={menuButton} type="button" variant="ghost" size="icon" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls={menuOpen ? 'mobile-navigation' : undefined} onClick={() => setMenuOpen(!menuOpen)} className="min-h-11 min-w-11 text-white hover:bg-white/10 hover:text-white lg:hidden">
            {menuOpen ? <X className="h-5 w-5"/> : <Menu className="h-5 w-5"/>}
          </Button>
        </div>
      </div>

      {menuOpen && <nav ref={menuPanel} id="mobile-navigation" aria-label="Mobile navigation" className="max-h-[70dvh] overflow-y-auto border-t border-white/10 bg-[#151024] p-3 lg:hidden">
        {[...navigation, { name: 'Study hands', icon: BookOpen, page: 'PastPlayedHands' }, { name: 'Tester chips', icon: Coins, page: 'TesterChips' }, { name: 'Fairness', icon: ShieldCheck, page: 'ProvablyFair' }].map(({ name, icon: Icon, page }) => <Link key={page} to={'/' + page}
          aria-current={currentPageName === page ? 'page' : undefined}
          className={'flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 text-sm ' + (currentPageName === page ? 'bg-pink-600 font-bold' : 'text-gray-200 hover:bg-white/10')}><Icon className="h-4 w-4"/>{name}</Link>)}
      </nav>}
    </header>

    <AnnouncementBanner />
    {error && <div role="alert" className="flex flex-wrap items-center justify-center gap-3 border-b border-red-400/30 bg-red-950 p-3 text-sm text-red-100">{error}<button type="button" disabled={signingOut} onClick={() => void signOut()} className="rounded border border-red-200/40 px-3 py-2 font-bold disabled:opacity-50">{signingOut ? 'Signing out…' : 'Retry sign out'}</button></div>}
    <div id="page-content" tabIndex={-1} className="min-w-0 overflow-x-clip pb-20 outline-none md:pb-0"><PageTransition>{children}</PageTransition></div>
    <BottomTabBar />

    <footer className="border-t border-white/10 bg-[#100b1b] px-4 pb-28 pt-10 md:pb-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 md:grid-cols-[2fr_1fr_1fr]">
          <div><p className="font-black text-amber-200">IMPERIAL GAMES</p><p className="mt-3 max-w-md text-sm leading-6 text-gray-400">A shared table, a fresh stack, and your next good hand. Practice with fictional tester chips and review your play together.</p><p className="mt-3 text-xs text-gray-500">Tester chips have no cash value. They cannot be purchased, transferred for value or redeemed. Players 21+.</p></div>
          <nav aria-label="Player resources"><h2 className="mb-3 text-sm font-bold">At the tables</h2><ul className="space-y-3 text-sm text-gray-400">
            {[['PokerLobby', 'Poker lobby'], ['Games', 'Game library'], ['TesterChips', 'How tester chips work'], ['Support', 'Support tickets']].map(([page, label]) => <li key={page}><Link to={'/' + page} className="hover:text-pink-300">{label}</Link></li>)}
          </ul></nav>
          <nav aria-label="Site policies"><h2 className="mb-3 text-sm font-bold">Information</h2><ul className="space-y-3 text-sm text-gray-400">{legalLinks.map(([page, label]) => <li key={page}><Link to={'/' + page} className="hover:text-pink-300">{label}</Link></li>)}</ul></nav>
        </div>
        <p className="mt-8 border-t border-white/10 pt-6 text-xs text-gray-500">© 2026 Imperial House Gaming LLC · Tester-chip preview</p>
      </div>
    </footer>
  </div>;
}
