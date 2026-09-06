import React from 'react';
import { base44 } from '@/api/base44Client';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
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

// Guard: blocks excluded users from play pages
function ExcludedGuard({ children }) {
  const [status, setStatus] = React.useState('loading'); // loading | ok | excluded
  React.useEffect(() => {
    base44.auth.me().then(u => setStatus(u?.is_excluded ? 'excluded' : 'ok')).catch(() => setStatus('ok'));
  }, []);
  if (status === 'loading') return null;
  if (status === 'excluded') return <ExclusionBanner />;
  return children;
}
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/PlayImperialLightning" element={<ExcludedGuard><PlayImperialLightning /></ExcludedGuard>} />
      <Route path="/BlackjackLobby" element={<LayoutWrapper currentPageName="BlackjackLobby"><BlackjackLobby /></LayoutWrapper>} />
      <Route path="/PlayMultiplayerBlackjack" element={<PlayMultiplayerBlackjack />} />
      <Route path="/ProfileStats" element={<LayoutWrapper currentPageName="ProfileStats"><ProfileStats /></LayoutWrapper>} />
      <Route path="/Leaderboard" element={<LayoutWrapper currentPageName="Leaderboard"><Leaderboard /></LayoutWrapper>} />
      <Route path="/FairnessManifesto" element={<LayoutWrapper currentPageName="FairnessManifesto"><FairnessManifesto /></LayoutWrapper>} />
      <Route path="/Licensing" element={<LayoutWrapper currentPageName="Licensing"><Licensing /></LayoutWrapper>} />
      <Route path="/OwnerKeyring" element={<OwnerKeyring />} />
      <Route path="/PlayMysticForest" element={<LayoutWrapper currentPageName="PlayMysticForest"><PlayMysticForest /></LayoutWrapper>} />
      <Route path="/PlayGoldenDragon" element={<LayoutWrapper currentPageName="PlayGoldenDragon"><PlayGoldenDragon /></LayoutWrapper>} />
      <Route path="/PlayAztecTreasure" element={<LayoutWrapper currentPageName="PlayAztecTreasure"><PlayAztecTreasure /></LayoutWrapper>} />
      <Route path="/PlayFarmageddon" element={<LayoutWrapper currentPageName="PlayFarmageddon"><PlayFarmageddon /></LayoutWrapper>} />
      <Route path="/PlayerProfile" element={<LayoutWrapper currentPageName="PlayerProfile"><PlayerProfile /></LayoutWrapper>} />
      <Route path="/PlaySlide" element={<LayoutWrapper currentPageName="PlaySlide"><PlaySlide /></LayoutWrapper>} />
      <Route path="/PlayBalloons" element={<LayoutWrapper currentPageName="PlayBalloons"><PlayBalloons /></LayoutWrapper>} />
      <Route path="/PlayDarts" element={<LayoutWrapper currentPageName="PlayDarts"><PlayDarts /></LayoutWrapper>} />
      <Route path="/KYCVerification" element={<LayoutWrapper currentPageName="KYCVerification"><KYCVerification /></LayoutWrapper>} />
      <Route path="/Staking" element={<LayoutWrapper currentPageName="Staking"><Staking /></LayoutWrapper>} />
      <Route path="/Bonuses" element={<LayoutWrapper currentPageName="Bonuses"><Bonuses /></LayoutWrapper>} />
      <Route path="/CryptoWallet" element={<LayoutWrapper currentPageName="CryptoWallet"><CryptoWallet /></LayoutWrapper>} />
      <Route path="/AMOE" element={<LayoutWrapper currentPageName="AMOE"><AMOE /></LayoutWrapper>} />
      <Route path="/PrizeClaims" element={<LayoutWrapper currentPageName="PrizeClaims"><PrizeClaims /></LayoutWrapper>} />
      <Route path="/AdminSweepstakesAudit" element={<LayoutWrapper currentPageName="AdminSweepstakesAudit"><AdminSweepstakesAudit /></LayoutWrapper>} />
      <Route path="/AdminIGTSupply" element={<LayoutWrapper currentPageName="AdminIGTSupply"><AdminIGTSupply /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (isDark) => {
      document.documentElement.classList.toggle('dark', isDark);
    };

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