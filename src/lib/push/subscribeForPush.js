const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export default async function subscribeForPushMulti(userIds = []) {
  try {
    if (!('serviceWorker' in navigator)) return { error: 'sw_unsupported' };
    const reg = await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { error: 'permission_denied' };

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) return { error: 'missing_vapid_public_key' };

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const baseUrl = (import.meta.env.VITE_SERVER_LAB_URL || '').replace(/\/$/, '');
    const API = baseUrl ? `${baseUrl}/api` : '/api';

    const results = [];
    const ids = Array.from(new Set((userIds || []).filter(Boolean)));
    for (const userId of ids) {
      const payload = {
        userId,
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.getKey ? btoa(String.fromCharCode.apply(null, new Uint8Array(sub.getKey('p256dh')))) : null,
          auth: sub.getKey ? btoa(String.fromCharCode.apply(null, new Uint8Array(sub.getKey('auth')))) : null,
        },
      };
      const res = await fetch(`${API}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      results.push(res.ok);
    }

    return { ok: results.every(Boolean), details: results };
  } catch (e) {
    return { error: e?.message || 'unknown_error' };
  }
}
