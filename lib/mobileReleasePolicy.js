// Product-scope guard for the native client, not a replacement for server authorization.
// Hosted stage activation and release approval must still be verified separately.
export function isNativePracticeApp(runtime = globalThis.window?.Capacitor) {
  if (!runtime) return false;
  try {
    return runtime.isNativePlatform?.() === true || ['android', 'ios'].includes(runtime.getPlatform?.());
  } catch {
    // An unreadable native bridge must not accidentally enable wallet credits.
    return true;
  }
}

export function assertNativeWalletCreditsDisabled(runtime = globalThis.window?.Capacitor) {
  if (!isNativePracticeApp(runtime)) return;
  const error = new Error('Wallet-credit reward redemption and publication are unavailable in this private APK.');
  error.code = 'NATIVE_REDEMPTION_DISABLED';
  throw error;
}
