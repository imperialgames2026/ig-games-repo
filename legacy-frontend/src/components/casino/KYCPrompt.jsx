import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function KYCPrompt() {
  const [user, setUser] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        const dismissedKey = `kyc_dismissed_${currentUser.email}`;
        setDismissed(!!localStorage.getItem(dismissedKey));
      } catch (error) {
        setUser(null);
      }
    };
    loadUser();
  }, [location.pathname]);

  const handleDismiss = () => {
    if (user) {
      localStorage.setItem(`kyc_dismissed_${user.email}`, 'true');
      setDismissed(true);
    }
  };

  const shouldShow = false;

  if (!shouldShow) {
    return null;
  }

  return (
    <Dialog open={shouldShow}>
      <DialogContent className="max-w-md border-pink-500/20 bg-white dark:bg-[#1A1528]">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-pink-500/10 flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6 text-pink-500" />
          </div>
          <DialogTitle className="text-center text-xl">Complete Your KYC</DialogTitle>
          <DialogDescription className="text-center">
            Verify your identity to complete account approval and unlock full access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            This reminder is only shown to players who have not been approved yet.
          </p>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleDismiss}>
              Remind Me Later
            </Button>
            <Link to={createPageUrl('KYCVerification')} className="flex-1">
              <Button className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700">
                Start KYC
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}