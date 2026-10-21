import React from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import NavigationTracker from '@/lib/NavigationTracker';
import { pagesConfig } from './pages.config';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/lib/ProtectedRoute';
import CommandCenterLayout from '@/components/admin/CommandCenterLayout';
import PracticeChipBar from '@/components/casino/PracticeChipBar';
import GameUnavailable from '@/components/games/GameUnavailable';
import Login from './pages/Login';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import TesterChips from './pages/TesterChips';
import SiteLoading from './components/SiteLoading';

const { Pages, Layout, mainPage } = pagesConfig;
const publicPages = new Set([
  'Home', 'Games', 'CookiesPolicy', 'Licensing', 'PrivacyPolicy',
  'ResponsiblePlay', 'TermsOfService', 'FairnessManifesto', 'ResetPassword', 'TesterChips', 'PokerLobby',
]);
// Preserve the historical modules for later work, but this release has one
// tester-chip experience and no financial-request or token-staking screens.
const financialPages = new Set([
  'Payments', 'Withdraw', 'CryptoWallet', 'DepositNetworks', 'IGNToken',
  'ImperialMembership', 'Bonuses', 'AMOE', 'Store', 'Staking', 'VIP',
  'Progression', 'Referrals', 'PrizeClaims', 'ThankYou', 'IGTTransfer',
]);
// Only these game pages have reviewed zero-wager server handlers.
// A successful Vite build never authorizes direct legacy wallet settlement.
const verifiedPracticeGames = new Set(['PlayDice', 'PlayCraps', 'PlayRoulette', 'PlayCrash', 'PlayTrenball', 'PlayBaccarat', 'PlayPoker', 'PlayOmaha', 'PlayBlackjack', 'PlayMultiplayerBlackjack', 'PlayCoinFlip', 'PlayHashDice', 'PlayLimbo', 'PlayPlinko', 'PlayWheel', 'PlayMines', 'PlayDarts', 'PlayDiceZone', 'PlayHiLo', 'PlayRocket', 'PlayTowers']);
const adminPages = new Set([
  'Admin', 'AdminAnnouncements', 'AdminKYC', 'AdminSupport', 'AdminUsers',
  'AdminWallets', 'AdminSweepstakesAudit', 'AdminIGTSupply', 'OwnerKeyring', 'SuperadminPokerTournaments', 'PokerBotLab', 'AdminTreasury', 'AdminLegacyTools',
]);

const withAccess = (path, element) => {
  if (publicPages.has(path)) return element;
  if (/^Play[A-Z]/.test(path) && !verifiedPracticeGames.has(path)) {
    return <ProtectedRoute><GameUnavailable game={path} /></ProtectedRoute>;
  }
  const roles = ['SuperadminPokerTournaments', 'AdminUsers', 'PokerBotLab'].includes(path) ? ['superadmin'] : adminPages.has(path) ? ['admin', 'superadmin'] : undefined;
  return <ProtectedRoute roles={roles}>{element}</ProtectedRoute>;
};

const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : () => null;

const LayoutWrapper = ({children,currentPageName}) => adminPages.has(currentPageName)
  ? <CommandCenterLayout>{children}</CommandCenterLayout>
  : Layout ? <Layout currentPageName={currentPageName}>{children}</Layout> : <>{children}</>;

function AuthenticatedApp() {
  const { isLoadingAuth, authError, navigateToLogin } = useAuth();

  if (isLoadingAuth) {
    return (
      <SiteLoading label="Checking sign-in" fullScreen />
    );
  }

  if (authError?.type === 'user_not_registered') return <UserNotRegisteredError />;
  if (authError?.type === 'auth_required') {
    navigateToLogin();
    return null;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={withAccess(mainPageKey, <LayoutWrapper currentPageName={mainPageKey}><MainPage /></LayoutWrapper>)}
      />
      {[...financialPages].map(path => <Route key={path} path={`/${path}`}
        element={<LayoutWrapper currentPageName="TesterChips"><TesterChips /></LayoutWrapper>} />)}
      {Object.entries(Pages).filter(([path]) => !financialPages.has(path)).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={withAccess(path, <LayoutWrapper currentPageName={path}><Page /></LayoutWrapper>)}
        />
      ))}
      <Route path="*" element={<LayoutWrapper currentPageName="NotFound"><PageNotFound /></LayoutWrapper>} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <PracticeChipBar />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster richColors position="top-right" />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
