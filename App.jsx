import React from 'react';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import NavigationTracker from '@/lib/NavigationTracker';
import { pagesConfig } from './pages.config';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/lib/ProtectedRoute';
import Login from './pages/Login';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const { Pages, Layout, mainPage } = pagesConfig;
const publicPages = new Set([
  'Home', 'Games', 'CookiesPolicy', 'Licensing', 'PrivacyPolicy',
  'ResponsiblePlay', 'TermsOfService', 'Leaderboard', 'FairnessManifesto',
]);
const adminPages = new Set([
  'Admin', 'AdminAnnouncements', 'AdminKYC', 'AdminSupport', 'AdminUsers',
  'AdminWallets', 'AdminSweepstakesAudit', 'AdminIGTSupply', 'OwnerKeyring',
]);

const withAccess = (path, element) => {
  if (publicPages.has(path)) return element;
  const roles = adminPages.has(path) ? ['admin', 'superadmin'] : undefined;
  return <ProtectedRoute roles={roles}>{element}</ProtectedRoute>;
};

const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : () => null;

const LayoutWrapper = ({ children, currentPageName }) => Layout
  ? <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

function AuthenticatedApp() {
  const { isLoadingAuth, authError, navigateToLogin } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" role="status" aria-label="Checking sign-in">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
      </div>
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
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={withAccess(path, <LayoutWrapper currentPageName={path}><Page /></LayoutWrapper>)}
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

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
  );
}

export default App;
