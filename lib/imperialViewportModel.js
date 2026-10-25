export const DEFAULT_IMPERIAL_VIEWPORT = Object.freeze({
  width: 1024,
  height: 768,
  orientation: 'landscape',
  deviceClass: 'desktop',
  isNative: false,
  isPhone: false,
  isTablet: false,
  isCompact: false,
  uiScale: 1,
  gameScale: 1,
  pixelRatio: 1,
  shortSide: 768,
  longSide: 1024,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function computeImperialViewport({ width, height, pixelRatio = 1, isNative = false } = {}) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : DEFAULT_IMPERIAL_VIEWPORT.width;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : DEFAULT_IMPERIAL_VIEWPORT.height;
  const shortSide = Math.min(safeWidth, safeHeight);
  const longSide = Math.max(safeWidth, safeHeight);
  const orientation = safeWidth >= safeHeight ? 'landscape' : 'portrait';

  let deviceClass = 'desktop';
  if (shortSide <= 374) deviceClass = 'compact-phone';
  else if (shortSide <= 430) deviceClass = 'phone';
  else if (shortSide <= 600) deviceClass = 'large-phone';
  else if (shortSide <= 900) deviceClass = 'tablet';

  const isPhone = deviceClass.includes('phone');
  const isTablet = deviceClass === 'tablet';
  const isCompact = deviceClass === 'compact-phone';

  if (!isNative) {
    return {
      width: safeWidth,
      height: safeHeight,
      orientation,
      deviceClass,
      isNative: false,
      isPhone,
      isTablet,
      isCompact,
      uiScale: 1,
      gameScale: 1,
      pixelRatio,
      shortSide,
      longSide,
    };
  }

  let uiScale = 1;
  let gameScale = 1;

  if (deviceClass === 'compact-phone') {
    uiScale = 0.84;
    gameScale = 0.74;
  } else if (deviceClass === 'phone') {
    uiScale = 0.88;
    gameScale = 0.80;
  } else if (deviceClass === 'large-phone') {
    uiScale = 0.92;
    gameScale = 0.86;
  } else if (deviceClass === 'tablet') {
    uiScale = 0.96;
    gameScale = 0.94;
  }

  if (orientation === 'landscape' && isPhone && safeHeight < 500) {
    gameScale -= 0.04;
  }

  if (isPhone && longSide / shortSide >= 2.05) {
    uiScale -= 0.02;
  }

  return {
    width: safeWidth,
    height: safeHeight,
    orientation,
    deviceClass,
    isNative: true,
    isPhone,
    isTablet,
    isCompact,
    uiScale: clamp(Number(uiScale.toFixed(3)), 0.80, 1),
    gameScale: clamp(Number(gameScale.toFixed(3)), 0.68, 1),
    pixelRatio,
    shortSide,
    longSide,
  };
}
