import React, { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Home, Gamepad2, Wallet, User } from 'lucide-react';

const tabs = [
  { name: 'Home', icon: Home, page: 'Home' },
  { name: 'Games', icon: Gamepad2, page: 'Games' },
  { name: 'Payments', icon: Wallet, page: 'Payments' },
  { name: 'Profile', icon: User, page: 'Profile' },
];

// Stack storage for each tab
const tabStacks = {
  Home: [],
  Games: [],
  Payments: [],
  Profile: [],
};

export default function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPage = location.pathname.split('/').pop() || 'Home';
  const lastTapRef = useRef({ tab: null, time: 0 });

  // Determine which tab owns the current page
  const getActiveTab = () => {
    // Game play pages belong to Games tab
    if (currentPage.startsWith('Play') || currentPage === 'Games') return 'Games';
    if (['Payments','CryptoWallet','Withdraw','DepositNetworks'].includes(currentPage)) return 'Payments';
    if (currentPage === 'Profile' || currentPage === 'TransactionHistory') return 'Profile';
    return 'Home';
  };

  const activeTab = getActiveTab();

  // Track navigation for stack preservation
  useEffect(() => {
    const tab = getActiveTab();
    if (!tabStacks[tab].includes(currentPage)) {
      tabStacks[tab].push(currentPage);
    }
  }, [currentPage]);

  const handleTabClick = (e, tab) => {
    const now = Date.now();
    const isActiveTap = activeTab === tab.page;
    
    // Double tap detection (within 500ms)
    if (isActiveTap && lastTapRef.current.tab === tab.page && (now - lastTapRef.current.time) < 500) {
      e.preventDefault();
      // Pop to root of this tab's stack
      navigate(createPageUrl(tab.page), { replace: true });
      tabStacks[tab.page] = [tab.page];
      lastTapRef.current = { tab: null, time: 0 };
    } else {
      lastTapRef.current = { tab: tab.page, time: now };
      if (!isActiveTap) {
        // Restore last page in target tab's stack
        const targetStack = tabStacks[tab.page];
        const lastPage = targetStack.length > 0 ? targetStack[targetStack.length - 1] : tab.page;
        if (lastPage !== currentPage) {
          e.preventDefault();
          navigate(createPageUrl(lastPage));
        }
      }
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#0A0612]/95 backdrop-blur-xl border-t border-white/10 md:hidden z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.page;
          
          return (
            <Link
              key={tab.page}
              to={createPageUrl(tab.page)}
              onClick={(e) => handleTabClick(e, tab)}
              className="flex-1 py-3 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors select-none"
              style={{
                color: isActive ? '#ec4899' : '#9ca3af',
                WebkitTouchCallout: 'none',
              }}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}