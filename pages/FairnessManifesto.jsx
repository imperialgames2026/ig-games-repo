import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import PracticePolicy from '@/components/casino/PracticePolicy';

export default function FairnessManifesto() {
  return <PracticePolicy title="Fairness Manifesto" icon={ShieldCheck}>
    <p>Practice should make the rules visible and results understandable. The tester-chip preview uses server-owned game state, with verification tools for supported practice rounds.</p>
    <section><h2>Server-owned play</h2><p>The browser submits player actions. The server checks access, turns and game state, then returns the authorized result. A displayed chip count is a practice state, not a redeemable balance.</p></section>
    <section><h2>Round commitments and verification</h2><p>Supported games commit to a server seed before revealing a result. After a round is revealed, its verification tools check the commitment and reproduce the outcome using the recorded inputs. Use the proof controls in each game or the <Link to="/ProvablyFair">practice round verifier</Link> for supported Dice rounds.</p></section>
    <section><h2>Shared poker tables</h2><p>Private hole cards and future deck information must stay hidden during a hand. Shared state shows the board, pot, seats and actions that players are entitled to see. Completed-hand records support review after play.</p></section>
    <section><h2>What to report</h2><p>Report an incorrect turn, missing action, inconsistent chip count or failed proof through <Link to="/Support">support tickets</Link>. Include the game, room or round identifier, the action you took and the time it happened. Do not share passwords or another player’s private information.</p></section>
    <section><h2>Testing scope</h2><p>Verification of one practice round does not establish that every game rule or system path is correct. This preview is still being tested and does not represent independent certification or readiness for real-value play.</p></section>
  </PracticePolicy>;
}
