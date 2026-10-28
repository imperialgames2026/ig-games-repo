import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft } from 'lucide-react';

const rootPages = ['Home', 'Games', 'Payments', 'Profile'];

export default function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPage = location.pathname.split('/').pop() || '';
  
  // Show header on all non-root pages on mobile
  const isRootPage = rootPages.includes(currentPage) || currentPage === '';
  
  if (isRootPage) return null;

  const handleBack = () => {
    // Check if we can go back in history
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Fallback navigation logic
      if (currentPage.startsWith('Play')) {
        navigate(createPageUrl('Games'));
      } else if (currentPage === 'TransactionHistory') {
        navigate(createPageUrl('Profile'));
      } else {
        navigate(createPageUrl('Home'));
      }
    }
  };

  return (
    <div data-mobile-page-header className="sticky top-0 z-40 bg-[#0A0612]/95 backdrop-blur-xl border-b border-white/10 md:hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center h-14 px-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-white hover:text-pink-400 transition-colors select-none active:scale-95"
          style={{ WebkitTouchCallout: 'none' }}
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
      </div>
    </div>
  );
}