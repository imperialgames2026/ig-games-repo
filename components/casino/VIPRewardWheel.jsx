import React from 'react';
import { isNativePracticeApp } from '@/lib/mobileReleasePolicy';
import WebVIPRewardWheel from './WebVIPRewardWheel';
import NativeRewardWheelNotice from './NativeRewardWheelNotice';

export default function VIPRewardWheel() {
  return isNativePracticeApp() ? <NativeRewardWheelNotice /> : <WebVIPRewardWheel />;
}
