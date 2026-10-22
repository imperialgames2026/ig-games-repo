import React from 'react';
import { isNativePracticeApp } from '@/lib/mobileReleasePolicy';
import WebRewardWheelSettings from '@/components/admin/WebRewardWheelSettings';
import NativeRewardWheelNotice from '@/components/casino/NativeRewardWheelNotice';

export default function AdminRewardWheels() {
  return isNativePracticeApp() ? <NativeRewardWheelNotice /> : <WebRewardWheelSettings />;
}
