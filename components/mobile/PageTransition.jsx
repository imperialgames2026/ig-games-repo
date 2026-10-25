import React from 'react';

export default function PageTransition({ children }) {
  // Route content must mount immediately, including when WebView suspends an
  // outgoing animation. Waiting for its exit can strand an invisible old page.
  return <div className="w-full">{children}</div>;
}
