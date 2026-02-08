import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const triggerHaptic = async (style: 'light' | 'medium' | 'heavy' = 'light') => {
  try {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;

    let impactStyle = ImpactStyle.Light;
    if (style === 'medium') impactStyle = ImpactStyle.Medium;
    if (style === 'heavy') impactStyle = ImpactStyle.Heavy;

    await Haptics.impact({ style: impactStyle });
  } catch (e) {
    console.warn('Haptics failed', e);
  }
};

export const triggerSelectionHaptic = async () => {
  try {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;
    await Haptics.selectionStart();
  } catch (e) {
    console.warn('Selection haptic failed', e);
  }
};

export const triggerSuccessHaptic = async () => {
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (!isMobile) return;
      await Haptics.notification({ type: 'SUCCESS' as any });
    } catch (e) {
      console.warn('Success haptic failed', e);
    }
};
