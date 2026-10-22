// Keep main's reviewed web contract unchanged while native redemption stays off.
export * from './webVipWheelDraw.js';
import { createVipWheelDraw as createWebVipWheelDraw } from './webVipWheelDraw.js';
import { assertNativeWalletCreditsDisabled } from './mobileReleasePolicy.js';

export function createVipWheelDraw(client) {
  const service = createWebVipWheelDraw(client);
  return {
    ...service,
    async spin(...args) {
      assertNativeWalletCreditsDisabled();
      return service.spin(...args);
    },
    async publish(...args) {
      assertNativeWalletCreditsDisabled();
      return service.publish(...args);
    },
  };
}
