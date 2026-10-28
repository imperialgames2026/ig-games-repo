import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { ArrowLeft, Crown, DollarSign, Gamepad2, LockKeyhole, LogOut, MessageCircle, ShieldCheck, User, Users } from 'lucide-react';
import { toast } from 'sonner';

const rootPages = ['Home', 'Games', 'Payments', 'Profile'];

export default function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPage = location.pathname.split('/').pop() || '';
  const { user, logout } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const isRootPage = rootPages.includes(currentPage) || currentPage === '';

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else if (currentPage.startsWith('Play')) {
      navigate(createPageUrl('Games'));
    } else if (currentPage === 'TransactionHistory') {
      navigate(createPageUrl('Profile'));
    } else {
      navigate(createPageUrl('Home'));
    }
  };

  const closeMenu = () => setProfileMenuOpen(false);
  const signOut = async () => {
    closeMenu();
    try {
      await logout();
    } catch {
      toast.error('Could not sign out. Please try again.');
    }
  };

  const avatarLabel = user?.full_name || user?.email || 'Open profile menu';
  const initial = (user?.full_name?.[0] || user?.email?.[0] || 'P').toUpperCase();

  return (
    <header
      className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0612]/95 backdrop-blur-xl md:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex h-14 items-center justify-between px-4">
        <div className="min-w-0">
          {isRootPage ? (
            <Link to={createPageUrl('Home')} className="flex items-center gap-2 text-white" aria-label="Imperial Gaming home">
              <img src="/imperial-gaming.png" alt="" className="h-8 w-8 rounded-full object-cover" />
              <span className="truncate text-sm font-black tracking-wide">IMPERIAL GAMING</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleBack}
              className="flex min-h-11 items-center gap-2 text-white transition-colors hover:text-pink-400 active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
          )}
        </div>

        {user && (
          <button
            type="button"
            onClick={() => setProfileMenuOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
            aria-label={`Open profile menu for ${avatarLabel}`}
            aria-haspopup="dialog"
            aria-expanded={profileMenuOpen}
          >
            {user.profile_picture ? (
              <img
                src={user.profile_picture}
                alt=""
                className="h-9 w-9 rounded-full border-2 border-pink-500 object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-pink-500 bg-gradient-to-br from-pink-500 to-pink-700 text-sm font-bold text-white">
                {initial}
              </span>
            )}
          </button>
        )}
      </div>

      {user && (
        <Drawer open={profileMenuOpen} onOpenChange={setProfileMenuOpen} shouldScaleBackground={false}>
          <DrawerContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#1A1528] text-white">
            <div className="space-y-1 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
              <div className="mb-2 flex items-center gap-3 border-b border-white/10 px-3 pb-4 pt-2">
                {user.profile_picture ? (
                  <img src={user.profile_picture} alt="" className="h-12 w-12 rounded-full border-2 border-pink-500 object-cover" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-pink-500 bg-gradient-to-br from-pink-500 to-pink-700 font-bold">
                    {initial}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">{user.full_name || 'Player'}</p>
                  <p className="truncate text-sm text-gray-400">{user.email}</p>
                </div>
              </div>

              <Link to={createPageUrl('Profile')} onClick={closeMenu} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/10">
                <User className="h-4 w-4" /> Profile settings
              </Link>
              <Link to={createPageUrl('TransactionHistory')} onClick={closeMenu} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/10">
                <DollarSign className="h-4 w-4" /> Transaction history
              </Link>

              {(user.role === 'admin' || user.role === 'superadmin' || user.role === 'tester') && (
                <>
                  <div className="my-2 border-t border-white/10" />
                  <Link to={createPageUrl('Admin')} onClick={closeMenu} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/10">
                    <Crown className="h-4 w-4" /> Admin dashboard
                  </Link>
                  {user.role !== 'tester' && (
                    <Link to={createPageUrl('AdminAnnouncements')} onClick={closeMenu} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/10">
                      <Gamepad2 className="h-4 w-4" /> Manage announcements
                    </Link>
                  )}
                  <Link to={createPageUrl('AdminSupport')} onClick={closeMenu} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/10">
                    <MessageCircle className="h-4 w-4" /> Live support
                  </Link>
                  {(user.role === 'admin' || user.role === 'superadmin') && (
                    <Link to={createPageUrl('AdminIGTSupply')} onClick={closeMenu} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/10">
                      <LockKeyhole className="h-4 w-4" /> IGT supply dashboard
                    </Link>
                  )}
                  {user.role === 'superadmin' && (
                    <>
                      <Link to={createPageUrl('AdminUsers')} onClick={closeMenu} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/10">
                        <Users className="h-4 w-4" /> User management
                      </Link>
                      <Link to={createPageUrl('AdminWallets')} onClick={closeMenu} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/10">
                        <DollarSign className="h-4 w-4" /> Wallet management
                      </Link>
                      <Link to={createPageUrl('AdminKYC')} onClick={closeMenu} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/10">
                        <ShieldCheck className="h-4 w-4" /> KYC review
                      </Link>
                    </>
                  )}
                </>
              )}

              <div className="my-2 border-t border-white/10" />
              <button
                type="button"
                onClick={signOut}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-red-400 hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </header>
  );
}
