import React from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/lib/ProtectedRoute';
import Login from './pages/Login';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import PlayImperialLightning from './pages/PlayImperialLightning';
import PlayMysticForest from './pages/PlayMysticForest';
import PlayGoldenDragon from './pages/PlayGoldenDragon';
import PlayAztecTreasure from './pages/PlayAztecTreasure';
import PlayFarmageddon from './pages/PlayFarmageddon';
import OwnerKeyring from './pages/OwnerKeyring';
import PlayerProfile from './pages/PlayerProfile';
import BlackjackLobby from './pages/BlackjackLobby';
import PlayMultiplayerBlackjack from './pages/PlayMultiplayerBlackjack';
import ExclusionBanner from './components/casino/ExclusionBanner';
import ProfileStats from './pages/ProfileStats';
import Leaderboard from './pages/Leaderboard';
import FairnessManifesto from './pages/FairnessManifesto';
import Licensing from './pages/Licensing';
import PlaySlide from './pages/PlaySlide';
import PlayBalloons from './pages/PlayBalloons';
import PlayDarts from './pages/PlayDarts';
import KYCVerification from './pages/KYCVerification';
import Staking from './pages/Staking';
import Bonuses from './pages/Bonuses';
import CryptoWallet from './pages/CryptoWallet';
import AMOE from './pages/AMOE';
import PrizeClaims from './pages/PrizeClaims';
import AdminSweepstakesAudit from './pages/AdminSweepstakesAudit';
import AdminIGTSupply from './pages/AdminIGTSupply';

const { Pages, Layout, mainPage } = pagesConfig;
const publicPages = new Set(['Home', 'Games', 'CookiesPolicy', 'Licensing', 'PrivacyPolicy', 'ResponsiblePlay', 'TermsOfService', 'Leaderboard', 'FairnessManifesto']);
const adminPages = new Set(['Admin', 'AdminAnnouncements', 'AdminKYC', 'AdminSupport', 'AdminUsers', 'AdminWallets', 'AdminSweepstakesAudit', 'AdminIGTSupply', 'OwnerKeyring']);
const withAccess = (path, element) => {
  if (publicPages.has(path)) return element;
  const roles = adminPages.has(path) ? ['admin', 'superadmin'] : undefined;
  return <ProtectedRoute roles={roles}>{element}</ProtectedRoute>;
};

function ExcludedGuard({ children }) {
  const { user } = useAuth();
  if (user?.is_excluded) return <ExclusionBanner />;
  return children;
}

const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, navigateToLogin } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={withAccess(mainPageKey, <LayoutWrapper currentPageName={mainPageKey}><MainPage /></LayoutWrapper>)} />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route key={path} path={`/${path}`} element={withAccess(path, <LayoutWrapper currentPageName={path}><Page /></LayoutWrapper>)} />
      ))}
      <Route path="/PlayImperialLightning" element={withAccess("PlayImperialLightning", <ExcludedGuard><PlayImperialLightning /></ExcludedGuard>)} />
      <Route path="/BlackjackLobby" element={withAccess("BlackjackLobby", <LayoutWrapper currentPageName="BlackjackLobby"><BlackjackLobby /></LayoutWrapper>)} />
      <Route path="/PlayMultiplayerBlackjack" element={withAccess("PlayMultiplayerBlackjack", <PlayMultiplayerBlackjack />)} />
      <Route path="/ProfileStats" element={withAccess("ProfileStats", <LayoutWrapper currentPageName="ProfileStats"><ProfileStats /></LayoutWrapper>)} />
      <Route path="/Leaderboard" element={withAccess("Leaderboard", <LayoutWrapper currentPageName="Leaderboard"><Leaderboard /></LayoutWrapper>)} />
      <Route path="/FairnessManifesto" element={withAccess("FairnessManifesto", <LayoutWrapper currentPageName="FairnessManifesto"><FairnessManifesto /></LayoutWrapper>)} />
      <Route path="/Licensing" element={withAccess("Licensing", <LayoutWrapper currentPageName="Licensing"><Licensing /></LayoutWrapper>)} />
      <Route path="/OwnerKeyring" element={withAccess("OwnerKeyring", <OwnerKeyring />)} />
      <Route path="/PlayMysticForest" element={withAccess("PlayMysticForest", <LayoutWrapper currentPageName="PlayMysticForest"><PlayMysticForest /></LayoutWrapper>)} />
      <Route path="/PlayGoldenDragon" element={withAccess("PlayGoldenDragon", <LayoutWrapper currentPageName="PlayGoldenDragon"><PlayGoldenDragon /></LayoutWrapper>)} />
      <Route path="/PlayAztecTreasure" element={withAccess("PlayAztecTreasure", <LayoutWrapper currentPageName="PlayAztecTreasure"><PlayAztecTreasure /></LayoutWrapper>)} />
      <Route path="/PlayFarmageddon" element={withAccess("PlayFarmageddon", <LayoutWrapper currentPageName="PlayFarmageddon"><PlayFarmageddon /></LayoutWrapper>)} />
      <Route path="/PlayerProfile" element={withAccess("PlayerProfile", <LayoutWrapper currentPageName="PlayerProfile"><PlayerProfile /></LayoutWrapper>)} />
      <Route path="/PlaySlide" element={withAccess("PlaySlide", <LayoutWrapper currentPageName="PlaySlide"><PlaySlide /></LayoutWrapper>)} />
      <Route path="/PlayBalloons" element={withAccess("PlayBalloons", <LayoutWrapper currentPageName="PlayBalloons"><PlayBalloons /></LayoutWrapper>)} />
      <Route path="/PlayDarts" element={withAccess("PlayDarts", <LayoutWrapper currentPageName="PlayDarts"><PlayDarts /></LayoutWrapper>)} />
      <Route path="/KYCVerification" element={withAccess("KYCVerification", <LayoutWrapper currentPageName="KYCVerification"><KYCVerification /></LayoutWrapper>)} />
      <Route path="/Staking" element={withAccess("Staking", <LayoutWrapper currentPageName="Staking"><Staking /></LayoutWrapper>)} />
      <Route path="/Bonuses" element={withAccess("Bonuses", <LayoutWrapper currentPageName="Bonuses"><Bonuses /></LayoutWrapper>)} />
      <Route path="/CryptoWallet" element={withAccess("CryptoWallet", <LayoutWrapper currentPageName="CryptoWallet"><CryptoWallet /></LayoutWrapper>)} />
      <Route path="/AMOE" element={withAccess("AMOE", <LayoutWrapper currentPageName="AMOE"><AMOE /></LayoutWrapper>)} />
      <Route path="/PrizeClaims" element={withAccess("PrizeClaims", <LayoutWrapper currentPageName="PrizeClaims"><PrizeClaims /></LayoutWrapper>)} />
      <Route path="/AdminSweepstakesAudit" element={withAccess("AdminSweepstakesAudit", <LayoutWrapper currentPageName="AdminSweepstakesAudit"><AdminSweepstakesAudit /></LayoutWrapper>)} />
      <Route path="/AdminIGTSupply" element={withAccess("AdminIGTSupply", <LayoutWrapper currentPageName="AdminIGTSupply"><AdminIGTSupply /></LayoutWrapper>)} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = (isDark) => document.documentElement.classList.toggle('dark', isDark);
    applyTheme(mediaQuery.matches);
    const handleChange = (event) => applyTheme(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App