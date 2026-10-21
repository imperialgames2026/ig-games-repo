import React from 'react';
import { Link } from 'react-router-dom';
import { Scale } from 'lucide-react';
import PracticePolicy from '@/components/casino/PracticePolicy';

export default function TermsOfService() {
  return <PracticePolicy title="Terms of Service" icon={Scale}>
    <p>These terms describe the Imperial Games tester-chip preview. Participation is for practice and product testing by players aged 21 or older.</p>
    <section><h2>Practice play only</h2><p>All gameplay uses fictional tester chips or free practice rounds. Chips have no cash value, cannot be purchased or redeemed, and do not represent a deposit, debt, investment or prize. There are no real-currency deposits, withdrawals or sweepstakes redemptions in this preview.</p></section>
    <section><h2>Your account</h2><p>Use your own account and keep your credentials private. Confirm your email before joining authenticated games. Do not impersonate another person, access another account or share private account information in a room key or support message.</p></section>
    <section><h2>Fair testing</h2><ul><li>Respect other players and do not harass, collude with or deceive participants.</li><li>Do not attempt to alter balances, reveal other players’ private cards or bypass access controls.</li><li>Run automated players only in sessions coordinated by the test operator. Report suspected defects through <Link to="/Support">support</Link>.</li></ul></section>
    <section><h2>Test data and availability</h2><p>Tables, practice stacks and test results may be reset during testing. Access and features may change while defects are fixed. A practice result does not establish entitlement to money, tokens or prizes.</p></section>
    <section><h2>Taking a break</h2><p>Use <Link to="/ResponsiblePlay">Responsible Play</Link> for break guidance and account self-exclusion. Self-exclusion restricts practice-game access and cannot be reversed from the player account.</p></section>
    <section><h2>Privacy and questions</h2><p>Read the <Link to="/PrivacyPolicy">preview privacy notice</Link> and <Link to="/CookiesPolicy">browser storage notice</Link>. Contact the operator through <Link to="/Support">support tickets</Link> about your account or these testing rules.</p></section>
  </PracticePolicy>;
}
