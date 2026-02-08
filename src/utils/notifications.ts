import { LocalNotifications } from '@capacitor/local-notifications';
import { triggerSuccessHaptic } from './haptics';

export const scheduleReminder = async (id: number, title: string, type: 'movie' | 'tv') => {
  try {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      alert(`Reminder set for: ${title}`);
      return;
    }

    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') {
      const { display: newPermission } = await LocalNotifications.requestPermissions();
      if (newPermission !== 'granted') return;
    }

    // Schedule for 1 hour from now for testing, or could be a specific date
    const scheduleTime = new Date(Date.now() + 1000 * 60 * 60); // 1 hour later

    await LocalNotifications.schedule({
      notifications: [
        {
          title: "🎬 Watch Reminder",
          body: `Don't forget to watch "${title}"!`,
          id: id,
          schedule: { at: scheduleTime },
          extra: { id, type }
        }
      ]
    });

    triggerSuccessHaptic();
    alert(`Reminder set for: ${title} (in 1 hour)`);
  } catch (e) {
    console.error('Failed to schedule notification', e);
  }
};

export const cancelReminder = async (id: number) => {
  try {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;

    await LocalNotifications.cancel({
      notifications: [{ id }]
    });
  } catch (e) {
    console.warn('Failed to cancel notification', e);
  }
};
