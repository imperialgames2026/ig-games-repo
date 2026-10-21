import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Gamepad2, Crown, UserRound } from 'lucide-react';

const tabs = [
  { name: 'Home', icon: Home, page: 'Home', to: '/' },
  { name: 'Games', icon: Gamepad2, page: 'Games', to: '/Games' },
  { name: 'Poker', icon: Crown, page: 'PokerLobby', to: '/PokerLobby' },
  { name: 'Profile', icon: UserRound, page: 'Profile', to: '/Profile' },
];

export default function BottomTabBar() {
  const { pathname } = useLocation();
  const page = pathname.split('/')[1] || 'Home';
  const activeTab = ['PokerLobby', 'PokerMultiTable', 'PlayPoker', 'PlayOmaha', 'PastPlayedHands', 'PokerHandReview'].includes(page)
    ? 'PokerLobby' : page.startsWith('Play') || page === 'Games' ? 'Games'
      : ['Profile', 'TransactionHistory', 'ProfileStats'].includes(page) ? 'Profile' : page === 'Home' ? 'Home' : null;

  return <nav aria-label="Bottom navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0A0612]/95 backdrop-blur-xl md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
    <div className="mx-auto flex max-w-lg items-center justify-around">
      {tabs.map(({ name, icon: Icon, page: target, to }) => <Link key={target} to={to}
        aria-current={activeTab === target ? 'page' : undefined}
        className={'flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-3 text-xs font-medium transition-colors ' + (activeTab === target ? 'text-pink-300' : 'text-gray-400 hover:text-white')}>
        <Icon aria-hidden="true" className="h-5 w-5" /><span>{name}</span>
      </Link>)}
    </div>
  </nav>;
}
