import React from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import PracticePolicy from '@/components/casino/PracticePolicy';

export default function CookiesPolicy() {
  return <PracticePolicy title="Cookies & Browser Storage" icon={Cookie}>
    <p>The tester-chip preview uses browser storage to support sign-in and recover practice activity. This page describes the active application rather than advertising services from the original site.</p>
    <section><h2>Sign-in storage</h2><p>Supabase authentication persists your session in browser storage and refreshes it while you use the site. Sign out before leaving a shared device. Clearing browser storage can sign you out.</p></section>
    <section><h2>Practice recovery and preferences</h2><p>Some practice games save a pending request or fairness commitment locally to recover a round after a reload. The multi-table poker view stores your open room list for the current browser session. Clearing storage can remove these local recovery records and preferences.</p></section>
    <section><h2>External requests</h2><p>Images served by external hosts use normal browser requests. The active navigation tracker is disabled; this preview does not load the legacy Google or Bing advertising tags.</p></section>
    <section><h2>Your controls</h2><p>Use your browser’s site-data settings to view or clear stored data. Blocking all browser storage can prevent sign-in or practice recovery. Read the <Link to="/PrivacyPolicy">privacy notice</Link> for account data and support requests.</p></section>
  </PracticePolicy>;
}
