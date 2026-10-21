import React from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import PracticePolicy from '@/components/casino/PracticePolicy';

export default function PrivacyPolicy() {
  return <PracticePolicy title="Privacy Policy" icon={Shield}>
    <p>This notice describes data used by the Imperial Games tester-chip preview. Use only the information needed for your testing account; do not submit bank details, identity documents, private keys or payment information.</p>
    <section><h2>Account and session data</h2><p>Registration uses your name, email and password through Supabase authentication. Your profile, role and account restrictions control access to the site. Your browser stores authentication session information so you can remain signed in.</p></section>
    <section><h2>Practice activity</h2><p>Server-hosted practice rooms store seating, chip actions, completed hands and related game records. Completed hands can support player statistics and testing reviews. Players in a shared room can see public table activity; private hole cards are restricted by the game’s server-side rules.</p></section>
    <section><h2>Support and operations</h2><p>Support tickets contain the messages you submit and account identifiers needed to respond. Authorized operators can review records needed to manage testing, investigate reported defects and enforce account restrictions. Hosting and backend services may keep technical connection and error logs.</p></section>
    <section><h2>Browser storage and external content</h2><p>Read the <Link to="/CookiesPolicy">browser storage notice</Link> for sign-in and practice-recovery storage. Some game artwork is loaded from external image hosts, which receive normal browser requests when those images load.</p></section>
    <section><h2>Your requests</h2><p>You can update supported profile fields from your account. For access, correction or deletion requests, contact the operator through <Link to="/Support">support tickets</Link>. Never include your password or authentication tokens in a ticket.</p></section>
  </PracticePolicy>;
}
