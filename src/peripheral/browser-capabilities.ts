type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

type WakeLockSentinel = {
  release: () => Promise<void>;
  released: boolean;
  addEventListener: (type: "release", listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinel>;
  };
};

export function canNotify(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!canNotify()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!canNotify()) return "unsupported";
  return Notification.requestPermission();
}

export function showBreakEndedNotification(mission: string): boolean {
  if (!canNotify() || Notification.permission !== "granted") return false;

  new Notification("Break ended", {
    body: mission ? `Return to focus: ${mission}` : "Return to focus.",
    silent: false,
  });
  return true;
}

export async function setAppBadge(value?: number): Promise<boolean> {
  const badgeNavigator = navigator as BadgeNavigator;
  if (!badgeNavigator.setAppBadge) return false;

  await badgeNavigator.setAppBadge(value);
  return true;
}

export async function clearAppBadge(): Promise<boolean> {
  const badgeNavigator = navigator as BadgeNavigator;
  if (!badgeNavigator.clearAppBadge) return false;

  await badgeNavigator.clearAppBadge();
  return true;
}

export async function requestScreenWakeLock(): Promise<WakeLockSentinel | null> {
  const wakeLockNavigator = navigator as WakeLockNavigator;
  if (!wakeLockNavigator.wakeLock) return null;

  try {
    return await wakeLockNavigator.wakeLock.request("screen");
  } catch {
    return null;
  }
}
