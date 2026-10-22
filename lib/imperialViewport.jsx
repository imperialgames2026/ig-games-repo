import React from 'react';
import { computeImperialViewport, DEFAULT_IMPERIAL_VIEWPORT } from './imperialViewportModel';

function readNativeFlag() {
  try {
    return Boolean(window.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

export function readImperialViewport() {
  if (typeof window === 'undefined') return DEFAULT_IMPERIAL_VIEWPORT;
  const visual = window.visualViewport;
  return computeImperialViewport({
    width: visual?.width || window.innerWidth,
    height: visual?.height || window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
    isNative: readNativeFlag(),
  });
}

const ViewportContext = React.createContext(DEFAULT_IMPERIAL_VIEWPORT);

function applyViewportToDocument(viewport) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.igNative = viewport.isNative ? 'true' : 'false';
  root.dataset.igDeviceClass = viewport.deviceClass;
  root.dataset.igOrientation = viewport.orientation;
  root.style.setProperty('--ig-viewport-width', `${viewport.width}px`);
  root.style.setProperty('--ig-viewport-height', `${viewport.height}px`);
  root.style.setProperty('--ig-ui-scale', String(viewport.uiScale));
  root.style.setProperty('--ig-game-scale', String(viewport.gameScale));
  if (viewport.isNative) root.style.fontSize = `${(16 * viewport.uiScale).toFixed(2)}px`;
  else root.style.removeProperty('font-size');
}

export function ImperialViewportProvider({ children }) {
  const [viewport, setViewport] = React.useState(readImperialViewport);

  React.useEffect(() => {
    let frame = 0;
    const refresh = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = readImperialViewport();
        setViewport(next);
        applyViewportToDocument(next);
      });
    };

    refresh();
    window.addEventListener('resize', refresh, { passive: true });
    window.addEventListener('orientationchange', refresh, { passive: true });
    window.visualViewport?.addEventListener('resize', refresh, { passive: true });
    window.visualViewport?.addEventListener('scroll', refresh, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
      window.visualViewport?.removeEventListener('resize', refresh);
      window.visualViewport?.removeEventListener('scroll', refresh);
    };
  }, []);

  return <ViewportContext.Provider value={viewport}>{children}</ViewportContext.Provider>;
}

export function useImperialViewport() {
  return React.useContext(ViewportContext);
}

export function AdaptiveGameViewport({ children }) {
  const viewport = useImperialViewport();
  if (!viewport.isNative || viewport.gameScale >= 0.999) return <>{children}</>;

  const widthPercent = 100 / viewport.gameScale;
  const heightPercent = 100 / viewport.gameScale;

  return (
    <div
      className="ig-adaptive-game-viewport"
      data-device-class={viewport.deviceClass}
      data-orientation={viewport.orientation}
      style={{
        zoom: viewport.gameScale,
        width: `${widthPercent}%`,
        minHeight: `${heightPercent}dvh`,
        maxWidth: `${widthPercent}%`,
      }}
    >
      {children}
    </div>
  );
}
