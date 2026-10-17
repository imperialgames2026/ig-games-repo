import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, Gamepad2, ShoppingBag, Settings, User, LogOut, Menu, X, 
  Coins, Crown, ChevronDown, Users, DollarSign, MessageCircle, ShieldCheck, Wallet, LockKeyhole 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import WalletDisplay from '@/components/casino/WalletDisplay';
import ReferralHandler from '@/components/casino/ReferralHandler';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import MobileHeader from '@/components/mobile/MobileHeader';
import PageTransition from '@/components/mobile/PageTransition';
import SupportChatWidget from '@/components/support/SupportChatWidget';
import KYCPrompt from '@/components/casino/KYCPrompt';
import GlobalChat from '@/components/chat/GlobalChat';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);

    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

export default function Layout({ children, currentPageName }) {
    const [user, setUser] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [currency, setCurrency] = useState(() => localStorage.getItem('preferredCurrency') || 'IC');
    const location = useLocation();
    const isMobile = useMediaQuery('(max-width: 768px)');

    useEffect(() => {
      const loadUser = async () => {
        try {
          const u = await base44.auth.me();
          setUser(u);
          if (u) {
            base44.functions.invoke('initializeUserIdentity', {}).catch(() => {});
            // Silent session tracking (IP, geo, device)
            base44.functions.invoke('trackSession', {}).catch((error) => {
              if (error?.response?.data?.reason === 'restricted_region' || error?.data?.reason === 'restricted_region') {
                alert('Access is not available in Washington or Idaho.');
                base44.auth.logout(window.location.href);
              }
            });
          }
        } catch (e) {
          // User not logged in
        }
      };
      loadUser();
    }, []);

    const handleCurrencyChange = (newCurrency) => {
      setCurrency(newCurrency);
      localStorage.setItem('preferredCurrency', newCurrency);
    };

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallet-layout', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: pendingKYC = [] } = useQuery({
    queryKey: ['pending-kyc-count'],
    queryFn: () => base44.entities.User.filter({ kyc_status: 'submitted' }),
    enabled: user?.role === 'superadmin',
    refetchInterval: 60000,
  });

  const wallet = wallets[0];
  const pendingKYCCount = pendingKYC.length;

  const navItems = [
    { name: 'Home', icon: Home, page: 'Home' },
    { name: 'Games', icon: Gamepad2, page: 'Games' },
    { name: 'Poker', icon: Crown, page: 'PokerLobby' },
    { name: 'Store', icon: ShoppingBag, page: 'Store' },
    { name: 'Bonuses', icon: Crown, page: 'Bonuses' },
    { name: 'Crypto', icon: Wallet, page: 'CryptoWallet' },
    { name: 'Referrals', icon: Users, page: 'Referrals' },
    { name: 'Support', icon: Settings, page: 'Support' },
  ];

  const isActive = (pageName) => currentPageName === pageName;

  // Don't show layout on play pages for cleaner experience
  const isPlayPage = currentPageName?.startsWith('Play');

  if (isPlayPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0612]" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ReferralHandler />
      <MobileHeader />
      <SupportChatWidget user={user} />
      <KYCPrompt />
      <GlobalChat user={user} />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#0A0612]/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/5 hidden md:block">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to={createPageUrl('Home')} className="flex items-center gap-2">
              <img 
                src="https://media.base44.com/images/public/697dc67abbb768c5bbbab5d5/669cada57_692efb11e_generated_image.png"
                alt="Imperial Gaming"
                className="w-10 h-10 rounded-full object-cover"
              />
              <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-pink-400 hidden sm:block">IMPERIAL GAMING</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all select-none ${
                    isActive(item.page)
                      ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                  }`}
                  style={{ WebkitTouchCallout: 'none' }}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              ))}
            </nav>

            {/* Right Section */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  {/* Wallet Display */}
                  <WalletDisplay wallet={wallet} compact currency={currency} onCurrencyChange={handleCurrencyChange} user={user} onBet={() => {}} />

                  {/* User Menu - Desktop Dropdown, Mobile Drawer */}
                  {isMobile ? (
                    <>
                      <Button 
                        variant="ghost" 
                        className="flex items-center gap-2 text-gray-900 dark:text-white"
                        onClick={() => setUserMenuOpen(true)}
                      >
                        {user.profile_picture ? (
                          <img
                            src={user.profile_picture}
                            alt="Profile"
                            className="w-8 h-8 rounded-full object-cover border-2 border-pink-500"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center">
                            <span className="text-sm font-bold">{user.full_name?.[0] || user.email?.[0]?.toUpperCase()}</span>
                          </div>
                        )}
                      </Button>
                      
                      <Drawer open={userMenuOpen} onOpenChange={setUserMenuOpen} shouldScaleBackground={false}>
                        <DrawerContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-white dark:bg-[#1A1528]">
                          <div className="p-4 space-y-2">
                            <div className="px-3 py-2 mb-2">
                              <p className="font-medium text-gray-900 dark:text-white">{user.full_name || 'Player'}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                            </div>
                          <Link 
                            to={createPageUrl('Profile')} 
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-3 rounded-lg min-h-[44px] hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white"
                          >
                            <User className="w-4 h-4" />
                            Profile Settings
                          </Link>
                          <Link 
                            to={createPageUrl('TransactionHistory')}
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-3 rounded-lg min-h-[44px] hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white"
                          >
                            <DollarSign className="w-4 h-4" />
                            Transaction History
                          </Link>
                          {(user.role === 'admin' || user.role === 'superadmin' || user.role === 'tester') && (
                            <>
                              <Link 
                                to={createPageUrl('Admin')}
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-2 px-3 py-3 rounded-lg min-h-[44px] hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white"
                              >
                                <Settings className="w-4 h-4" />
                                Admin Dashboard
                              </Link>
                              {user.role !== 'tester' && (
                                <Link 
                                  to={createPageUrl('AdminAnnouncements')}
                                  onClick={() => setUserMenuOpen(false)}
                                  className="flex items-center gap-2 px-3 py-3 rounded-lg min-h-[44px] hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white"
                                >
                                  <Gamepad2 className="w-4 h-4" />
                                  Manage Announcements
                                </Link>
                              )}
                              <Link 
                                to={createPageUrl('AdminSupport')}
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-2 px-3 py-3 rounded-lg min-h-[44px] hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white"
                              >
                                <MessageCircle className="w-4 h-4" />
                                Live Support
                              </Link>
                              {(user.role === 'admin' || user.role === 'superadmin') && (
                                <Link 
                                  to={createPageUrl('AdminIGTSupply')}
                                  onClick={() => setUserMenuOpen(false)}
                                  className="flex items-center gap-2 px-3 py-3 rounded-lg min-h-[44px] hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white"
                                >
                                  <LockKeyhole className="w-4 h-4" />
                                  IGT Supply Dashboard
                                </Link>
                              )}
                              {user.role === 'superadmin' && (
                                <>
                                  <Link 
                                    to={createPageUrl('AdminUsers')}
                                    onClick={() => setUserMenuOpen(false)}
                                    className="flex items-center gap-2 px-3 py-3 rounded-lg min-h-[44px] hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white"
                                  >
                                    <Users className="w-4 h-4" />
                                    User Management
                                  </Link>
                                  <Link 
                                    to={createPageUrl('AdminWallets')}
                                    onClick={() => setUserMenuOpen(false)}
                                    className="flex items-center gap-2 px-3 py-3 rounded-lg min-h-[44px] hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white"
                                  >
                                    <DollarSign className="w-4 h-4" />
                                    Wallet Management
                                  </Link>
                                  <Link 
                                    to={createPageUrl('AdminKYC')}
                                    onClick={() => setUserMenuOpen(false)}
                                    className="flex items-center gap-2 px-3 py-3 rounded-lg min-h-[44px] hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white"
                                  >
                                    <ShieldCheck className="w-4 h-4" />
                                    KYC Review
                                    {pendingKYCCount > 0 && (
                                      <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                                        {pendingKYCCount}
                                      </span>
                                    )}
                                  </Link>
                                </>
                              )}
                            </>
                          )}
                            <button
                              onClick={() => base44.auth.logout()}
                              className="flex items-center gap-2 px-3 py-3 rounded-lg min-h-[44px] hover:bg-gray-100 dark:hover:bg-white/10 text-red-500 dark:text-red-400 w-full text-left"
                            >
                              <LogOut className="w-4 h-4" />
                              Sign Out
                            </button>
                          </div>
                        </DrawerContent>
                      </Drawer>
                    </>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="flex items-center gap-2 text-gray-900 dark:text-white">
                          {user.profile_picture ? (
                            <img
                              src={user.profile_picture}
                              alt="Profile"
                              className="w-8 h-8 rounded-full object-cover border-2 border-pink-500"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center">
                              <span className="text-sm font-bold">{user.full_name?.[0] || user.email?.[0]?.toUpperCase()}</span>
                            </div>
                          )}
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 bg-white dark:bg-[#1A1528] border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
                        <div className="px-3 py-2">
                          <p className="font-medium">{user.full_name || 'Player'}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                        </div>
                        <DropdownMenuSeparator className="bg-gray-200 dark:bg-white/10" />
                        <DropdownMenuItem asChild className="cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10">
                          <Link to={createPageUrl('Profile')} className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Profile Settings
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10">
                          <Link to={createPageUrl('TransactionHistory')} className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Transaction History
                          </Link>
                        </DropdownMenuItem>
                        {(user.role === 'admin' || user.role === 'superadmin' || user.role === 'tester') && (
                          <>
                            <DropdownMenuItem asChild className="cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10">
                              <Link to={createPageUrl('Admin')} className="flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                Admin Dashboard
                              </Link>
                            </DropdownMenuItem>
                            {user.role !== 'tester' && (
                              <DropdownMenuItem asChild className="cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10">
                                <Link to={createPageUrl('AdminAnnouncements')} className="flex items-center gap-2">
                                  <Gamepad2 className="w-4 h-4" />
                                  Manage Announcements
                                </Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem asChild className="cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10">
                              <Link to={createPageUrl('AdminSupport')} className="flex items-center gap-2">
                                <MessageCircle className="w-4 h-4" />
                                Live Support
                              </Link>
                            </DropdownMenuItem>
                            {(user.role === 'admin' || user.role === 'superadmin') && (
                              <DropdownMenuItem asChild className="cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10">
                                <Link to={createPageUrl('AdminIGTSupply')} className="flex items-center gap-2">
                                  <LockKeyhole className="w-4 h-4" />
                                  IGT Supply Dashboard
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {user.role === 'superadmin' && (
                              <>
                                <DropdownMenuItem asChild className="cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10">
                                  <Link to={createPageUrl('AdminUsers')} className="flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    User Management
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10">
                                  <Link to={createPageUrl('AdminWallets')} className="flex items-center gap-2">
                                    <DollarSign className="w-4 h-4" />
                                    Wallet Management
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10">
                                  <Link to={createPageUrl('AdminKYC')} className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4" />
                                    KYC Review
                                    {pendingKYCCount > 0 && (
                                      <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                                        {pendingKYCCount}
                                      </span>
                                    )}
                                  </Link>
                                </DropdownMenuItem>
                              </>
                            )}
                          </>
                        )}
                        <DropdownMenuItem 
                          onClick={() => base44.auth.logout()}
                          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 text-red-500 dark:text-red-400"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Sign Out
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              ) : (
                <Button 
                  onClick={() => base44.auth.redirectToLogin()}
                  className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
                >
                  Sign In
                </Button>
              )}

              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-gray-900 dark:text-white"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-gray-200 dark:border-white/5"
            >
              <nav className="p-4 space-y-2 bg-white dark:bg-[#0A0612]">
                {navItems.map((item) => (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg min-h-[44px] transition-all select-none ${
                      isActive(item.page)
                        ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
                    style={{ WebkitTouchCallout: 'none' }}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.name}</span>
                  </Link>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 60px)' }} className="md:pb-0 text-[16px] overflow-x-hidden">
        <PageTransition>{children}</PageTransition>
      </main>
      
      <BottomTabBar />

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-[#0A0612] border-t border-gray-200 dark:border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Company Info */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img 
                  src="https://media.base44.com/images/public/697dc67abbb768c5bbbab5d5/669cada57_692efb11e_generated_image.png"
                  alt="Imperial Gaming"
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span className="font-black text-sm text-gray-900 dark:text-white">IMPERIAL GAMING</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Premium social casino entertainment. Play responsibly.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to={createPageUrl('Games')} className="text-gray-600 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 transition-colors">
                    Games
                  </Link>
                </li>
                <li>
                  <Link to={createPageUrl('Store')} className="text-gray-600 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 transition-colors">
                    Store
                  </Link>
                </li>
                <li>
                  <Link to={createPageUrl('Referrals')} className="text-gray-600 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 transition-colors">
                    Referrals
                  </Link>
                </li>
                <li>
                  <Link to={createPageUrl('Support')} className="text-gray-600 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 transition-colors">
                    Support
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to={createPageUrl('TermsOfService')} className="text-gray-600 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to={createPageUrl('PrivacyPolicy')} className="text-gray-600 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to={createPageUrl('FairnessManifesto')} className="text-gray-600 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 transition-colors">
                    Fairness Manifesto
                  </Link>
                </li>
                <li>
                  <Link to={createPageUrl('Licensing')} className="text-gray-600 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 transition-colors">
                    Licensing &amp; Registration
                  </Link>
                </li>
                <li>
                  <a href="mailto:support@imperialhouse.online" className="text-gray-600 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 transition-colors">
                    Contact Us
                  </a>
                </li>
              </ul>
            </div>

            {/* Responsible Gaming */}
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">Responsible Gaming</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                Imperial Gaming is a social casino for entertainment only. No real money gambling takes place on this platform.
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Must be 18+ to play. Virtual currency has no real-world value and cannot be exchanged for cash or prizes.
              </p>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-gray-200 dark:border-white/5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-500 mb-6">
              <p>© 2026 Imperial House Gaming LLC. All rights reserved.</p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                For entertainment purposes only
              </p>
            </div>
            
            {/* Centered Disclosure */}
            <div className="pt-4 border-t border-gray-200 dark:border-white/5 text-center space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Imperial Gaming is a premium social casino for entertainment only. Play responsibly.
              </p>
              <div className="text-xs text-gray-600 dark:text-gray-500 space-y-1 max-w-4xl mx-auto">
                <p>ImperialGaming.games is owned and operated by Imperial House Gaming also known as Imperial Gaming</p>
                <p>State Tax Registration number: 10-228399686F-001 | License number for Imperial Gaming LLC: 38-228399686F-001</p>
                <p>Registered address: 391 Brook Dr. Hot Springs, Virginia 24445 U.S.A.</p>
                <p>Support: <a href="mailto:support@imperialhouse.online" className="text-pink-400 hover:text-pink-300">support@imperialhouse.online</a> | Admin: <a href="mailto:admin@imperialhouse.online" className="text-pink-400 hover:text-pink-300">admin@imperialhouse.online</a></p>
                <p className="mt-3 text-gray-600 dark:text-gray-400 italic">
                  No purchase necessary to play or enter sweepstakes. Games and sweepstakes are void where prohibited by law. For detailed rules see{' '}
                  <Link to={createPageUrl('TermsOfService')} className="text-pink-400 hover:text-pink-300">
                    Terms of Service
                  </Link>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}