import __Layout from './Layout.jsx';

// Register only page modules that actually exist in this repository. This keeps
// the route registry synchronized with the exported page files and avoids stale
// imports left behind by the Base44 export.
const pageModules = import.meta.glob('./pages/*.jsx', { eager: true });

export const PAGES = Object.fromEntries(
  Object.entries(pageModules)
    .filter(([, module]) => typeof module.default === 'function')
    .map(([path, module]) => {
      const name = path.split('/').pop().replace(/\.jsx$/, '');
      return [name, module.default];
    })
);

export const pagesConfig = {
  mainPage: 'Home',
  Pages: PAGES,
  Layout: __Layout,
};
