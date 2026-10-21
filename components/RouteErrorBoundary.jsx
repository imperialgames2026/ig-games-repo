import React from 'react';

// A stale tab or interrupted connection can lose a lazily loaded page chunk.
// Keep navigation recoverable instead of leaving the player on a blank screen.
export default class RouteErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" className="mx-auto max-w-xl space-y-4 p-8 text-white">
      <h1 className="text-2xl font-bold">This page could not load</h1>
      <p className="text-slate-300">Check your connection and reload the page to continue.</p>
      <div className="flex flex-wrap gap-4">
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-pink-600 px-5 py-3 font-bold hover:bg-pink-500">Reload page</button>
        <a href="/Games" className="rounded-lg border border-white/30 px-5 py-3">Return to game library</a>
      </div>
    </section>;
  }
}
