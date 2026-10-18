import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import ReferralCodePrompt from './ReferralCodePrompt';

// Component to handle referral tracking and code generation
export default function ReferralHandler() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [prefillCode, setPrefillCode] = useState('');

  useEffect(() => {
    const initializeReferral = async () => {
      try {
        // Check if user has already seen the prompt
        const promptShown = localStorage.getItem('referral_prompt_shown');
        if (promptShown) return;

        const user = await base44.auth.me();
        if (!user?.email) return;
        
        setUserEmail(user.email);

        // Check if already referred
        const existing = await base44.entities.Referral.filter({ referred_email: user.email });
        if (existing.length > 0) return;

        // Check if user has a wallet (new users won't yet)
        const wallets = await base44.entities.UserWallet.filter({ user_email: user.email });

        // Try to grab ?ref= code from URL
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        if (refCode) {
          setPrefillCode(refCode);
          localStorage.setItem('referral_prompt_shown', 'true');
          setTimeout(() => setShowPrompt(true), 1500);
          return;
        }

        // Only show manual prompt to brand-new users (no wallet yet)
        if (wallets.length > 0) return;
        
        localStorage.setItem('referral_prompt_shown', 'true');
        setTimeout(() => setShowPrompt(true), 2000);
      } catch (error) {
        console.error('Referral initialization error:', error);
      }
    };

    initializeReferral();
  }, []);

  return (
    <ReferralCodePrompt
      open={showPrompt}
      onClose={() => setShowPrompt(false)}
      userEmail={userEmail}
      prefillCode={prefillCode}
      onSuccess={() => window.location.reload()}
    />
  );
}