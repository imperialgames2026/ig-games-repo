import React, { lazy, Suspense } from 'react';
import RouteErrorBoundary from './components/RouteErrorBoundary.jsx';
import __Layout from './Layout.jsx';
import SiteLoading from './components/SiteLoading.jsx';

// Register only page modules that actually exist in this repository. This keeps
// the route registry synchronized with the exported page files and avoids stale
// imports left behind by the Base44 export.
// Load the selected page only. Operator tools and archived game screens should
// not delay the public lobby or a player's table on a mobile connection.
const pageModules = /** @type {Record<string, () => Promise<{ default: import('react').ComponentType }>>} */ (
  import.meta.glob('./pages/*.jsx')
);

export const PAGES = Object.fromEntries(
  Object.entries(pageModules)
    .map(([path, load]) => {
      const name = path.split('/').pop().replace(/\.jsx$/, '');
      const Page = lazy(load);
      const RoutedPage = (props) => React.createElement(RouteErrorBoundary, null,
        React.createElement(
          Suspense,
          { fallback: React.createElement(SiteLoading) },
          React.createElement(Page, props),
        ),
      );
      return [name, RoutedPage];
    })
);

export const pagesConfig = {
  mainPage: 'Home',
  Pages: PAGES,
  Layout: __Layout,
};
